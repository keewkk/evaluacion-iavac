#!/usr/bin/env python3
"""Read-only GitHub evidence snapshots; Python 3.11+, standard library only."""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from delivery_context import capture_context, resolution_event


class Unavailable(Exception):
    pass


class GitHub:
    """Never print response bodies, credentials, or CLI stderr on API failure."""

    def get(self, path: str) -> Any:
        if not path.startswith("repos/") or ".." in path.split("/"):
            raise ValueError("Invalid API path")
        token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        if not token:
            try:
                result = subprocess.run(["gh", "api", path], capture_output=True, text=True, timeout=30)
            except (subprocess.TimeoutExpired, FileNotFoundError):
                raise Unavailable("GitHub CLI: no disponible o tiempo agotado") from None
            if result.returncode:
                raise Unavailable("GitHub CLI: consulta no disponible")
            return json.loads(result.stdout)
        request = Request("https://api.github.com/" + path, headers={
            "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            raise Unavailable(f"GitHub HTTP {error.code}") from None
        except (URLError, TimeoutError):
            raise Unavailable("GitHub: error de conexión") from None


def clean(value: Any) -> str:
    text = str(value or "")
    for key in ("GH_TOKEN", "GITHUB_TOKEN"):
        secret = os.environ.get(key)
        if secret:
            text = text.replace(secret, "[REDACTED]")
    text = re.sub(r"\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{16,})", "[REDACTED]", text)
    text = re.sub(r"(?i)\b(token|password|api[_-]?key|secret)\s*[:=]\s*\S+", r"\1=[REDACTED]", text)
    return re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)


def safe_url(value: Any) -> str:
    value = str(value or "")
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.netloc == "github.com" and not parsed.query and not re.search(r"[\s<>\x00-\x1f]", value):
        return value
    return ""


def language(text: str) -> dict[str, Any]:
    text = re.sub(r"```.*?```|https?://\S+|<[^>]*>", " ", text or "", flags=re.S)
    words = re.findall(r"[a-záéíóúñ]+", text.lower())
    en = sum(w in {"the", "with", "and", "for", "this", "add", "fix", "update", "tests", "implement", "feature", "build"} for w in words)
    es = sum(w in {"el", "la", "los", "las", "con", "para", "del", "se", "añadir", "pruebas", "función", "entrega"} for w in words)
    signal = "indeterminado" if max(en, es) < 3 else "mixto" if min(en, es) >= 3 else "señal inglesa" if en > es else "señal española"
    return {"signal": signal, "english_hits": en, "spanish_hits": es,
            "method": "léxico v1; excluye código cercado, HTML y URLs; incluye plantilla y checklists; no mide dominio"}


def calendar_window(date: str | None, config: dict[str, Any]) -> str | None:
    if not date:
        return None
    try:
        instant = datetime.fromisoformat(date.replace("Z", "+00:00"))
        if instant.tzinfo is None:
            return None
        day = instant.astimezone(ZoneInfo(config["timezone"])).date().isoformat()
    except (ValueError, KeyError):
        return None
    for window in config.get("windows", []):
        if window.get("start") and window["start"] <= day <= window["end"]:
            return str(window["sprint"])
    return None


def sprint_metadata(pr: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    declarations: set[str] = set()
    texts = [label["name"] for label in pr.get("labels", [])]
    texts.append((pr.get("milestone") or {}).get("title", ""))
    for text in texts:
        match = re.fullmatch(r"sprint[\s:_-]*0?([1-4])", text, re.I)
        if match:
            declarations.add(match[1])
    declarations.update(re.findall(r"(?im)^\s*sprint\s*:\s*0?([1-4])\s*$", pr.get("body") or ""))
    candidate = calendar_window(pr.get("merged_at") or pr.get("created_at"), config)
    conflict = len(declarations) > 1 or bool(candidate and declarations and candidate not in declarations)
    return {"declared": sorted(declarations), "calendar_candidate": candidate,
            "date_basis": "merged_at" if pr.get("merged_at") else "created_at", "conflict": conflict,
            "assignment": "pendiente de revisión" if len(declarations) != 1 or conflict else next(iter(declarations)),
            "calendar_status": config.get("calendar_status", "referencia")}


def identity(commit: dict[str, Any], config: dict[str, Any]) -> dict[str, str]:
    author = commit.get("author") or {}
    git_author = commit.get("commit", {}).get("author") or {}
    login = author.get("login", "")
    email = git_author.get("email", "").strip().lower()
    mapped_login = config.get("email_aliases", {}).get(email)
    if login:
        canonical = config.get("login_aliases", {}).get(login.lower(), login.lower())
        return {"key": canonical, "source": "alias configurado" if canonical != login.lower() else "cuenta asociada por GitHub",
                "kind": "bot" if author.get("type") == "Bot" or login.endswith("[bot]") else "cuenta sin matrícula verificada"}
    if mapped_login:
        return {"key": mapped_login.lower(), "source": "alias de correo configurado", "kind": "cuenta sin matrícula verificada"}
    return {"key": "sin-resolver-" + hashlib.sha256((email or commit["sha"]).encode()).hexdigest()[:12],
            "source": "autor Git sin cuenta asociada", "kind": "identidad pendiente"}


def valid_line_stats(detail: Any, sha: str) -> dict[str, int] | None:
    if not isinstance(detail, dict) or detail.get("sha") != sha:
        return None
    stats = detail.get("stats")
    if not isinstance(stats, dict) or any(type(stats.get(key)) is not int or stats[key] < 0 for key in ("additions", "deletions")):
        return None
    return {"additions": stats["additions"], "deletions": stats["deletions"]}


def contribution_summary(commits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: dict[tuple[str, str, str | None], dict[str, Any]] = {}
    for commit in {c["sha"]: c for c in commits}.values():
        identity = commit["identity"]
        key = (identity["key"], identity["kind"], commit.get("calendar_candidate"))
        row = rows.setdefault(key, {"identity": key[0], "kind": key[1], "calendar_candidate": key[2],
            "commits_in_snapshot": 0, "non_merge_commits": 0, "merge_commits": 0,
            "commits_with_line_stats": 0, "observed_lines_added": 0, "observed_lines_deleted": 0})
        row["commits_in_snapshot"] += 1
        if commit.get("merge_commit"):
            row["merge_commits"] += 1
            continue
        row["non_merge_commits"] += 1
        stats = commit.get("line_stats")
        if stats is not None:
            row["commits_with_line_stats"] += 1
            row["observed_lines_added"] += stats["additions"]
            row["observed_lines_deleted"] += stats["deletions"]
    for row in rows.values():
        complete = row["non_merge_commits"] > 0 and row["commits_with_line_stats"] == row["non_merge_commits"]
        row["lines_added"] = row["observed_lines_added"] if complete else None
        row["lines_deleted"] = row["observed_lines_deleted"] if complete else None
        row["line_stats_status"] = "no aplica: solo merges" if not row["non_merge_commits"] else "disponible" if complete else "parcial" if row["commits_with_line_stats"] else "no disponible"
    return [rows[key] for key in sorted(rows, key=str)]


def collect(api: Any, repo: str, config: dict[str, Any], pr_number: int | None = None,
            before: str | None = None, after: str | None = None, branch: str | None = None) -> dict[str, Any]:
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repo) or any(part in {".", ".."} for part in repo.split("/")):
        raise ValueError("Use owner/repository")
    base = f"repos/{repo}/"
    report: dict[str, Any] = {
        "schema_version": 3, "repository": repo, "collected_at": datetime.now(ZoneInfo(config["timezone"])).isoformat(),
        "scope": "snapshot de PR" if pr_number else "historial acumulado de rama" if branch else "rango de push", "sources": {}, "warnings": [],
        "commits": [], "reviews": [], "comments": [], "runs": [], "checks": [],
        "limitations": [
            "Snapshot al consultar; no reconstruye el estado histórico del evento ni el total del Sprint.",
            "Commits y líneas no miden desempeño, calidad, esfuerzo ni comprensión individual.",
            "Una cuenta GitHub no acredita matrícula; alias requieren validación docente. No atribuye coautorías automáticamente.",
            "Squash conserva un commit en main: para autoría se consultan los commits del PR original; deduplicar SHA entre reportes.",
            "Fecha de commit declarada en Git; puede diferir del push. Ventanas America/Santiago; inicio del Sprint 1 pendiente.",
            "Reviews y respuestas muestran actividad; no prueban resolución de hilos. No calcula tiempos de resolución.",
            "Steps exitosos no acreditan cantidad o cobertura de pruebas; --if-present puede omitir comandos. Despliegue no recopilado; statuses legacy no recopilados.",
            "Inglés: señal léxica en título y cuerpo de PR y mensajes de commits, con plantilla incluida; documentación no analizada.",
            "Scrum, worklogs, calidad del incremento, defensa individual e IA/investigación requieren GesPro y Sprint Review.",
            "Las líneas añadidas/eliminadas son cambios textuales acumulados por commit; incluyen documentación, pruebas, configuración, código generado y dependencias. No equivalen a código original ni retenido en la versión final.",
            "Los merges se cuentan aparte y se excluyen de líneas por identidad para evitar atribuir cambios de otras personas. No se estima tiempo ni desempeño.",
        ],
    }
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    if run_id.isdigit():
        report["collector_run_url"] = f"https://github.com/{repo}/actions/runs/{run_id}"

    def get(path: str, source: str) -> Any:
        try:
            result = api.get(base + path)
            report["sources"].setdefault(source, "disponible")
            return result
        except Unavailable as error:
            report["sources"][source] = "parcial/no disponible"
            report["warnings"].append(f"{source}: {error}")
            return None

    def pages(path: str, source: str, key: str | None = None, max_pages: int = 30) -> list[Any]:
        items: list[Any] = []
        for page in range(1, max_pages + 1):
            result = get(path + ("&" if "?" in path else "?") + urlencode({"per_page": 100, "page": page}), source)
            if result is None:
                break
            batch = result.get(key, []) if key else result
            if "compare/" in path and page == 1 and result.get("status") not in {"ahead", "identical"}:
                report["warnings"].append("Push divergente/retroceso: se muestran commits alcanzables nuevos; no representa commits retirados.")
            items.extend(batch)
            if len(batch) < 100:
                break
        else:
            report["sources"][source] = "parcial/límite de paginación"
            report["warnings"].append(f"{source}: límite de {max_pages * 100} elementos; no asumir exhaustividad")
        return items

    commits: list[Any] = []
    shas: set[str] = set()
    if pr_number:
        pr = get(f"pulls/{pr_number}", "pr")
        if pr:
            head = pr["head"]["sha"]
            shas.add(head)
            if pr.get("merge_commit_sha"):
                shas.add(pr["merge_commit_sha"])
            report["pr"] = {key: pr.get(key) for key in ("number", "state", "created_at", "updated_at", "closed_at", "merged_at", "commits", "changed_files", "additions", "deletions")}
            report["pr"].update({"url": safe_url(pr["html_url"]), "title": clean(pr["title"]),
                "author": pr["user"]["login"], "head_sha": head, "base_sha": pr["base"]["sha"],
                "source_branch": clean(pr["head"]["ref"]), "target_branch": clean(pr["base"]["ref"]),
                "official_delivery": pr["head"]["ref"] == "desa" and pr["base"]["ref"] == "main" and (pr["head"].get("repo") or {}).get("full_name") == repo,
                "description_present": bool((pr.get("body") or "").strip()),
                "description_length": len(pr.get("body") or ""), "sprint": sprint_metadata(pr, config),
                "english_title": language(pr["title"]), "english_description": language(pr.get("body") or "")})
            commits = pages(f"pulls/{pr_number}/commits", "commits", max_pages=3)
            if len(commits) != pr.get("commits"):
                report["sources"]["commits"] = "parcial"
                report["warnings"].append("Commits recopilados difieren del total del PR (API limitada a 250 o datos cambiantes).")
            for review in pages(f"pulls/{pr_number}/reviews", "reviews"):
                report["reviews"].append({"id": review["id"], "author": (review.get("user") or {}).get("login"),
                    "state": review["state"], "submitted_at": review.get("submitted_at"),
                    "calendar_candidate": calendar_window(review.get("submitted_at"), config), "url": safe_url(review.get("html_url"))})
            for endpoint, kind in [(f"pulls/{pr_number}/comments", "inline"), (f"issues/{pr_number}/comments", "conversación")]:
                for comment in pages(endpoint, "comments-" + kind):
                    report["comments"].append({"id": comment["id"], "kind": kind, "author": (comment.get("user") or {}).get("login"),
                        "created_at": comment["created_at"], "updated_at": comment.get("updated_at"),
                        "calendar_candidate": calendar_window(comment["created_at"], config),
                        "reply_to": comment.get("in_reply_to_id"), "url": safe_url(comment.get("html_url"))})
            current = get(f"pulls/{pr_number}", "pr-consistency")
            if current and (current["head"]["sha"] != head or current["updated_at"] != pr["updated_at"]):
                report["warnings"].append("El PR cambió durante la consulta; repetir la captura para evaluar.")
    elif branch:
        if branch not in {"desa", "main"}:
            raise ValueError("Branch must be desa or main")
        ref = get(f"git/ref/heads/{branch}", "branch")
        head = ((ref or {}).get("object") or {}).get("sha")
        if not head or not re.fullmatch(r"[0-9a-f]{40}", head):
            raise Unavailable("No se pudo fijar el SHA de la rama; no se genera una muestra vacía.")
        report["branch"] = {"name": branch, "head_sha": head, "excluded_root_commits": []}
        shas.add(head)
        history = pages(f"commits?sha={head}", "commits", max_pages=10)
        for commit in history:
            if commit.get("parents") == []:
                report["branch"]["excluded_root_commits"].append(commit["sha"])
            else:
                commits.append(commit)
        report["limitations"].append("Historial acumulado alcanzable desde el SHA de la rama, máximo 1000 commits; excluye commits raíz de inicialización. Incluye entregas ya integradas y mantenimiento institucional, que no deben atribuirse a estudiantes. No representa un Sprint ni solo cambios pendientes contra main.")
    elif before and after:
        if not all(re.fullmatch(r"[0-9a-f]{40}", sha) for sha in [before, after]):
            raise ValueError("Invalid SHA")
        report["push"] = {"before": before, "after": after}
        shas.add(after)
        if after == "0" * 40:
            report["warnings"].append("Rama eliminada: sin commits ni CI consultables para after.")
            shas.clear()
        elif before == "0" * 40:
            one = get(f"commits/{after}", "commits")
            commits = [one] if one else []
            report["sources"]["commits"] = "parcial/rama nueva"
            report["warnings"].append("Rama nueva: solo commit de punta; no se infiere el historial como aporte nuevo.")
        else:
            commits = pages(f"compare/{before}...{after}", "commits", "commits")
    else:
        raise ValueError("Specify --pr, --branch, or --before and --after")

    for commit in {c["sha"]: c for c in commits}.values():
        meta = commit["commit"]
        author = meta.get("author") or {}
        committer = meta.get("committer") or {}
        subject = meta.get("message", "").splitlines()
        merge = len(commit.get("parents", [])) > 1
        stats = None
        if not merge:
            detail = get(f"commits/{commit['sha']}", "line-stats")
            stats = valid_line_stats(detail, commit["sha"])
            if detail is not None and stats is None:
                report["sources"]["line-stats"] = "parcial/no disponible"
                report["warnings"].append("Líneas: alguna respuesta tiene estadísticas ausentes o inválidas; no se interpreta como cero.")
        report["commits"].append({"sha": commit["sha"], "url": safe_url(commit.get("html_url")),
            "identity": identity(commit, config), "authored_at": author.get("date"), "committed_at": committer.get("date"),
            "calendar_candidate": calendar_window(committer.get("date"), config),
            "subject": clean(subject[0] if subject else ""), "english_message": language(meta.get("message", "")),
            "merge_commit": merge, "line_stats": stats,
            "line_stats_status": "excluido: merge" if merge else "disponible" if stats is not None else "no disponible"})

    for sha in sorted(shas):
        report["checks"].extend({"name": clean(c["name"]), "sha": sha, "status": c["status"], "conclusion": c.get("conclusion"),
            "url": safe_url(c.get("html_url"))} for c in pages(f"commits/{sha}/check-runs", "checks", "check_runs"))
        runs = pages(f"actions/runs?head_sha={sha}", "actions", "workflow_runs", max_pages=1)
        if len(runs) > 20:
            report["warnings"].append("CI: solo se detallan las 20 ejecuciones más recientes por SHA.")
            report["sources"]["actions"] = "parcial/20 ejecuciones detalladas por SHA"
        for run in runs[:20]:
            if run["head_sha"] != sha:
                continue
            item = {"id": run["id"], "name": clean(run["name"]), "head_sha": sha, "event": run["event"],
                    "status": run["status"], "conclusion": run.get("conclusion"), "created_at": run["created_at"],
                    "url": safe_url(run["html_url"]), "jobs": []}
            for job in pages(f"actions/runs/{run['id']}/jobs", "jobs", "jobs"):
                item["jobs"].append({"name": clean(job["name"]), "conclusion": job.get("conclusion"), "status": job["status"],
                    "url": safe_url(job.get("html_url")), "steps": [{"name": clean(s["name"]), "status": s["status"],
                    "conclusion": s.get("conclusion")} for s in job.get("steps", [])]})
                for step in job.get("steps", []):
                    if step.get("conclusion") == "skipped" and re.search(r"(?i)(test|pytest|build|lint|ruff|deploy)", step["name"]):
                        report["warnings"].append(f"CI #{run['id']}: {clean(job['name'])} / {clean(step['name'])} omitido (skipped); no acredita ejecución.")
            report["runs"].append(item)
    report["runs"] = list({r["id"]: r for r in report["runs"]}.values())
    report["contributions"] = contribution_summary(report["commits"])
    if report.get("pr"):
        latest = get(f"pulls/{pr_number}", "pr-consistency-final")
        if latest and (latest["head"]["sha"] != report["pr"]["head_sha"] or latest["updated_at"] != report["pr"]["updated_at"]):
            report["warnings"].append("El PR cambió durante la consulta; repetir la captura para evaluar.")
    report["warnings"] = list(dict.fromkeys(report["warnings"]))
    return report


def markdown(report: dict[str, Any]) -> str:
    def cell(value: Any) -> str:
        value = html.escape(clean(value), quote=True).replace("|", "&#124;").replace("\n", " ").replace("\r", " ")
        return re.sub(r"([\\`*\[\]!_])", r"\\\1", value)

    def link(url: str, label: str) -> str:
        return f"[{cell(label)}](<{safe_url(url)}>)" if safe_url(url) else cell(label)

    lines = ["# Evidencia GitHub para Sprint Review", "", f"Repositorio: {cell(report['repository'])}", "",
             f"Captura: {cell(report['collected_at'])}. Alcance: {cell(report['scope'])}.", "",
             "Evidencia de actividad; requiere juicio docente. No es una nota ni un ranking.", ""]
    if report.get("collector_run_url"):
        lines += [link(report["collector_run_url"], "Ejecución que generó esta captura"), ""]
    context = report.get("resolution")
    if context:
        lines += [f"Resolución: {cell(context['kind'])}; fecha del evento: {cell(context['resolved_at']) or 'no aplica'}.", ""]
    pr = report.get("pr")
    if report.get("branch"):
        branch = report["branch"]
        lines += ["## Rama", "", f"Rama: {cell(branch['name'])}; SHA fijado: {cell(branch['head_sha'])}.", "",
                  "Historial acumulado, incluidas entregas anteriores y mantenimiento institucional. Se excluyen commits raíz de inicialización; no es el diff pendiente contra main ni un total del Sprint.", "",
                  f"Commits raíz excluidos: {len(branch['excluded_root_commits'])}.", ""]
    if report.get("push"):
        push = report["push"]
        lines += ["## Push", "", link(f"https://github.com/{report['repository']}/compare/{push['before']}...{push['after']}",
                  f"Rango {push['before'][:10]} → {push['after'][:10]}"), "",
                  f"Commits únicos recopilados: {len(report['commits'])}. Revisar advertencias de ramas nuevas o rangos incompletos.", ""]
    if pr:
        lines += ["## Pull Request", "", link(pr["url"], f"PR #{pr['number']}: {pr['title']}"), "",
                  f"Autor: {cell(pr['author'])}; {cell(pr['source_branch'])} → {cell(pr['target_branch'])}; estado: {cell(pr['state'])}; merge: {cell(pr['merged_at']) or 'sin merge'}.", "",
                  f"Entrega oficial desa → main del mismo repositorio: {'sí' if pr['official_delivery'] else 'no'}.", "",
                  f"Creado: {cell(pr['created_at'])}; actualizado: {cell(pr['updated_at'])}; cerrado: {cell(pr['closed_at'])}.", "",
                  f"Total PR: {pr['commits']} commits; {pr['changed_files']} archivos; +{pr['additions']} / −{pr['deletions']} líneas.", "",
                  f"Descripción presente: {'sí' if pr['description_present'] else 'no'} ({pr['description_length']} caracteres). Abrir PR para leerla.", "",
                  f"Sprint declarado: {cell(', '.join(pr['sprint']['declared'])) or 'ausente'}; ventana por fecha: {cell(pr['sprint']['calendar_candidate']) or 'sin asignar'}; asignación: {cell(pr['sprint']['assignment'])}.", "",
                  f"Señal de inglés — título: {cell(pr['english_title']['signal'])}; cuerpo: {cell(pr['english_description']['signal'])}. Incluye plantilla; no mide dominio.", ""]
    def quantity(value: Any) -> str:
        return "N/D" if value is None else str(value)

    lines += ["## Muestra de actividad por identidad y ventana", "",
              "Cantidades descriptivas de esta captura para revisión docente. No miden tiempo, calidad, esfuerzo ni desempeño. No equivalen a todos los integrantes ni al total del Sprint.", "",
              "| Identidad | Asociación | Ventana | Commits sin merge | Merges | Líneas añadidas | Líneas eliminadas | Stats disponibles |",
              "|---|---|---|---:|---:|---:|---:|---|"]
    lines += [f"| {cell(c['identity'])} | {cell(c['kind'])} | {cell(c['calendar_candidate']) or 'sin asignar'} | {c['non_merge_commits']} | {c['merge_commits']} | {quantity(c['lines_added'])} | {quantity(c['lines_deleted'])} | {c['commits_with_line_stats']}/{c['non_merge_commits']} |" for c in report["contributions"]]
    lines += ["", "Las líneas son cambios textuales sumados en commits sin merge: pueden incluir documentación, tests, configuración, código generado, dependencias, reformateos y reversiones. Una modificación puede contar como eliminación y adición. No equivalen a líneas originales ni a código que permanece en la entrega. Los cambios netos del PR se muestran aparte.", "",
              "N/D indica estadísticas incompletas o no aplicables; JSON conserva subtotales observados. Bots e identidades pendientes se muestran identificados; no se atribuyen a un estudiante.", "",
              "## Commits verificables", "", "| Commit | Identidad | Fecha Git | Añadidas | Eliminadas | Tipo | Mensaje | Inglés |", "|---|---|---|---:|---:|---|---|---|"]
    lines += [f"| {link(c['url'], c['sha'][:10])} | {cell(c['identity']['key'])} | {cell(c['committed_at'])} | {quantity((c.get('line_stats') or {}).get('additions'))} | {quantity((c.get('line_stats') or {}).get('deletions'))} | {'merge: excluido de líneas' if c['merge_commit'] else 'commit'} | {cell(c['subject'])} | {cell(c['english_message']['signal'])} |" for c in report["commits"]]
    lines += ["", "## Revisiones y comentarios", "", "| Evidencia | Cuenta | Fecha | Estado / respuesta a |", "|---|---|---|---|"]
    lines += [f"| {link(r['url'], 'Review ' + str(r['id']))} | {cell(r['author'])} | {cell(r['submitted_at'])} | {cell(r['state'])} |" for r in report["reviews"]]
    lines += [f"| {link(c['url'], c['kind'] + ' ' + str(c['id']))} | {cell(c['author'])} | {cell(c['created_at'])} | {cell(c['reply_to']) or 'sin relación de respuesta registrada'} |" for c in report["comments"]]
    if not report["reviews"] and not report["comments"]:
        lines += ["", "Sin revisiones/comentarios recopilados; revisar disponibilidad de fuentes. En push no se consultan PR."]
    lines += ["", "## GitHub Actions", "", "Snapshot por SHA de head y merge del PR. CI puede seguir en ejecución. Verde no acredita pruebas/build ejecutados.", ""]
    lines += ["success = exitoso; failure = fallido; skipped = omitido; cancelled = cancelado. Se muestran pasos técnicos; JSON conserva todos.", ""]
    if not report["runs"]:
        lines += ["Sin ejecuciones recopiladas: revisar disponibilidad de la fuente.", ""]
    for run in report["runs"]:
        lines += [f"### {link(run['url'], run['name'] + ' #' + str(run['id']))}", "",
                  f"SHA: {cell(run['head_sha'])}; {cell(run['event'])}; {cell(run['status'])}; {cell(run['conclusion']) or 'pendiente'}.", "",
                  "| Job / step | Resultado registrado |", "|---|---|"]
        for job in run["jobs"]:
            lines += [f"| {link(job['url'], job['name'])} | {cell(job['conclusion']) or cell(job['status'])} |"]
            lines += [f"| ↳ {cell(step['name'])} | {cell(step['conclusion']) or cell(step['status'])} |" for step in job["steps"]
                      if re.search(r"(?i)(test|pytest|build|lint|ruff|deploy)", step["name"])]
        lines += [""]
    lines += ["## Checks", "", "| Check | SHA | Estado | Resultado |", "|---|---|---|---|"]
    lines += [f"| {link(c['url'], c['name'])} | {cell(c['sha'][:10])} | {cell(c['status'])} | {cell(c['conclusion']) or 'pendiente'} |" for c in report["checks"]]
    lines += ["", "## Disponibilidad de fuentes", ""] + [f"- {cell(k)}: {cell(v)}" for k, v in report["sources"].items()]
    lines += ["", "## Advertencias", ""] + [f"- {cell(w)}" for w in report["warnings"]]
    lines += ["", "## Límites y evidencia complementaria", ""] + [f"- {cell(w)}" for w in report["limitations"]]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    parser.add_argument("--pr", type=int)
    parser.add_argument("--branch", choices=["desa", "main"])
    parser.add_argument("--before")
    parser.add_argument("--after")
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("evidence-config.json"))
    parser.add_argument("--output", type=Path, default=Path("reports/evidence"))
    args = parser.parse_args()
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    event = json.loads(Path(event_path).read_text()) if event_path else {}
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    if event_name and event_path and not resolution_event(event_name, event, args.repo or ""):
        print("Evento sin resolución de entrega oficial: no se genera reporte.")
        return
    pr_number = args.pr or (event.get("pull_request") or {}).get("number")
    if args.pr is not None and args.pr <= 0:
        parser.error("--pr debe ser un número positivo")
    if args.branch and (pr_number or args.before or args.after):
        parser.error("--branch no se combina con PR ni rango")
    config = json.loads(args.config.read_text())
    report = collect(GitHub(), args.repo or "", config, pr_number,
                     args.before or event.get("before"), args.after or event.get("after"), args.branch)
    report["resolution"] = capture_context(event_name, event, report)
    if report["resolution"]["head_matches_event"] is False:
        report["warnings"].append("El head consultado difiere del cierre: captura no coherente con la resolución; revisar antes de evaluar.")
    if event_name == "pull_request" and (report.get("pr") or {}).get("state") != "closed":
        report["warnings"].append("El PR ya no está cerrado al consultar; esta captura no representa fielmente su resolución.")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "evidence.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    rendered = markdown(report)
    (args.output / "summary.md").write_text(rendered)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(rendered[:900_000])


if __name__ == "__main__":
    main()

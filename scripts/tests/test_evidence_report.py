"""Synthetic fixtures: no personal data, credentials, or network calls."""
from copy import deepcopy
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
import sys
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "evidence_report.py"
sys.path.insert(0, str(SCRIPT.parent))
spec = importlib.util.spec_from_file_location("evidence_report", SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
# Calendar below is synthetic test data, independent from a future course period.
CONFIG = json.loads(SCRIPT.with_name("evidence-config.json").read_text())
CONFIG["windows"] = [
    {"sprint": "1", "start": None, "end": "2026-09-18"},
    {"sprint": "2", "start": "2026-09-19", "end": "2026-10-09"},
    {"sprint": "3", "start": "2026-10-10", "end": "2026-10-30"},
    {"sprint": "4", "start": "2026-10-31", "end": "2026-11-20"},
]
SHA = "a" * 40
BASE = "b" * 40
REPO = "example/course"


def commit(sha=SHA, login="alice", email="alias@example.invalid"):
    return {"sha": sha, "html_url": f"https://github.com/{REPO}/commit/{sha}",
            "author": {"login": login, "type": "User"} if login else None,
            "commit": {"author": {"email": email, "date": "2026-10-09T23:00:00Z"},
                       "committer": {"date": "2026-10-10T02:59:59Z"},
                       "message": "feat: implement the feature with tests"}, "parents": [{"sha": BASE}]}


def pr():
    return {"number": 1, "title": "Feature", "body": "Sprint: 2", "labels": [], "milestone": None,
            "user": {"login": "alice"}, "html_url": f"https://github.com/{REPO}/pull/1",
            "head": {"sha": SHA, "ref": "desa", "repo": {"full_name": REPO}},
            "base": {"sha": BASE, "ref": "main"}, "merge_commit_sha": None,
            "created_at": "2026-10-09T23:00:00Z", "updated_at": "2026-10-09T23:00:00Z",
            "closed_at": None, "merged_at": None, "state": "open", "commits": 1,
            "changed_files": 3, "additions": 5, "deletions": 2}


class FixtureAPI:
    def __init__(self):
        self.pr = pr()
        self.commits = [commit()]
        self.fail = set()
        self.calls = []
        self.reviews = []
        self.comments = []
        self.runs = []
        self.jobs = []

    def get(self, path):
        self.calls.append(path)
        if any(s in path for s in self.fail):
            raise m.Unavailable("HTTP 403")
        endpoint = path.split("?", 1)[0]
        page = int(path.split("page=")[-1]) if "page=" in path else 1
        if endpoint.endswith('/git/ref/heads/desa') or endpoint.endswith('/git/ref/heads/main'):
            return {'object': {'sha': SHA}}
        if endpoint.endswith("/pulls/1"):
            return deepcopy(self.pr)
        if re.search(r"/commits/[0-9a-f]{40}$", endpoint):
            detail = commit(sha=endpoint.rsplit("/", 1)[-1])
            detail["stats"] = {"additions": 5, "deletions": 2}
            return detail
        if "/compare/" in endpoint:
            return {"status": "ahead", "commits": deepcopy(self.commits[(page - 1) * 100:page * 100])}
        if endpoint.endswith("/commits"):
            return deepcopy(self.commits[(page - 1) * 100:page * 100])
        if endpoint.endswith("/reviews"):
            return deepcopy(self.reviews)
        if endpoint.endswith("/comments"):
            return deepcopy(self.comments)
        if endpoint.endswith("/check-runs"):
            return {"check_runs": []}
        if endpoint.endswith("/actions/runs"):
            return {"workflow_runs": deepcopy(self.runs)}
        if endpoint.endswith("/jobs"):
            return {"jobs": deepcopy(self.jobs)}
        raise AssertionError(path)


class EvidenceTests(unittest.TestCase):
    def test_manual_branch_history_pins_sha_and_excludes_initial_root(self):
        api = FixtureAPI()
        root = commit(sha=BASE, login='teacher')
        root['parents'] = []
        api.commits = [commit(), root]
        report = m.collect(api, REPO, CONFIG, branch='desa')
        self.assertEqual(report['scope'], 'historial acumulado de rama')
        self.assertEqual(report['branch']['head_sha'], SHA)
        self.assertEqual(report['branch']['excluded_root_commits'], [BASE])
        self.assertEqual(len(report['commits']), 1)
        self.assertTrue(any(f'commits?sha={SHA}&' in path for path in api.calls))
        self.assertFalse(any('/pulls/' in path for path in api.calls))
        self.assertIn('Historial acumulado', m.markdown(report))

    def test_manual_main_history(self):
        report = m.collect(FixtureAPI(), REPO, CONFIG, branch='main')
        self.assertEqual(report['branch']['name'], 'main')

    def test_branch_unavailable_fails_instead_of_claiming_zero(self):
        api = FixtureAPI()
        api.fail = {'git/ref/heads'}
        with self.assertRaises(m.Unavailable):
            m.collect(api, REPO, CONFIG, branch='desa')

    def test_branch_name_rejects_shell_and_arbitrary_refs(self):
        for branch in ['feature', '../main', '$(id)']:
            with self.assertRaises(ValueError):
                m.collect(FixtureAPI(), REPO, CONFIG, branch=branch)

    def test_branch_history_pagination(self):
        api = FixtureAPI()
        api.commits = [commit(sha=f'{i+1:040x}') for i in range(101)]
        report = m.collect(api, REPO, CONFIG, branch='desa')
        self.assertEqual(len(report['commits']), 101)

    def test_branch_history_truncation_is_explicit(self):
        api = FixtureAPI()
        api.commits = [commit(sha=f'{i+1:040x}') for i in range(1001)]
        report = m.collect(api, REPO, CONFIG, branch='desa')
        self.assertEqual(len(report['commits']), 1000)
        self.assertIn('parcial', report['sources']['commits'])

    def test_cli_manual_desa_without_pr(self):
        with tempfile.TemporaryDirectory() as temp:
            event = Path(temp) / 'event.json'
            event.write_text('{}')
            with patch.object(m, 'GitHub', return_value=FixtureAPI()), patch.dict(os.environ, {
                'GITHUB_EVENT_PATH': str(event), 'GITHUB_EVENT_NAME': 'workflow_dispatch',
                'GITHUB_REPOSITORY': REPO, 'GITHUB_STEP_SUMMARY': str(Path(temp) / 'job.md'),
            }), patch('sys.argv', [str(SCRIPT), '--branch', 'desa', '--output', temp]):
                m.main()
            report = json.loads((Path(temp) / 'evidence.json').read_text())
            self.assertEqual(report['branch']['name'], 'desa')
            self.assertEqual(report['resolution']['kind'], 'recaptura manual')

    def test_calendar_timezone_cutoff_and_next_day(self):
        self.assertEqual(m.calendar_window("2026-10-10T02:59:59Z", CONFIG), "2")
        self.assertEqual(m.calendar_window("2026-10-10T03:00:00Z", CONFIG), "3")

    def test_calendar_unknown_first_start_and_outside_term(self):
        for value in [None, "invalid", "2026-09-01T00:00:00Z", "2026-11-22T00:00:00Z", "2026-10-01T00:00:00"]:
            self.assertIsNone(m.calendar_window(value, CONFIG))

    def test_sprint_conflict_is_not_silently_reassigned(self):
        data = pr()
        data["body"] = "Sprint: 1\r\nHito: 1"
        result = m.sprint_metadata(data, CONFIG)
        self.assertEqual(result["declared"], ["1"])
        self.assertEqual(result["calendar_candidate"], "2")
        self.assertTrue(result["conflict"])
        self.assertEqual(result["assignment"], "pendiente de revisión")

    def test_sprint_missing_and_contradictory_metadata(self):
        data = pr()
        data["body"] = "Sprint:\nHito: 1"
        self.assertEqual(m.sprint_metadata(data, CONFIG)["declared"], [])
        data["labels"] = [{"name": "sprint-02"}]
        data["milestone"] = {"title": "Sprint 3"}
        self.assertTrue(m.sprint_metadata(data, CONFIG)["conflict"])

    def test_sprint_merge_date_is_explicit(self):
        data = pr()
        data["merged_at"] = "2026-10-11T12:00:00Z"
        self.assertEqual(m.sprint_metadata(data, CONFIG)["date_basis"], "merged_at")
        self.assertEqual(m.sprint_metadata(data, CONFIG)["calendar_candidate"], "3")

    def test_identity_alias_and_case(self):
        config = deepcopy(CONFIG)
        config["login_aliases"] = {"alice-old": "alice"}
        self.assertEqual(m.identity(commit(login="ALICE-old"), config)["key"], "alice")
        config["email_aliases"] = {"alias@example.invalid": "alice"}
        self.assertEqual(m.identity(commit(login=None, email="ALIAS@example.invalid"), config)["key"], "alice")

    def test_unknown_authors_are_not_merged_by_name(self):
        a = m.identity(commit(login=None, email="one@example.invalid"), CONFIG)
        b = m.identity(commit(login=None, email="two@example.invalid"), CONFIG)
        self.assertNotEqual(a["key"], b["key"])
        self.assertNotIn("@", json.dumps(a))

    def test_bot_is_not_student(self):
        self.assertEqual(m.identity(commit(login="dependabot[bot]"), CONFIG)["kind"], "bot")

    def test_language_short_code_and_mixed(self):
        self.assertEqual(m.language("feat: auth")['signal'], "indeterminado")
        self.assertEqual(m.language("```the and with``` https://example.invalid/the/and/with")['signal'], "indeterminado")
        self.assertEqual(m.language("implement the feature; la función para el equipo")['signal'], "mixto")

    def test_pr_capture_traceability_no_emails_or_bodies(self):
        report = m.collect(FixtureAPI(), REPO, CONFIG, 1)
        self.assertEqual(report["contributions"][0]["commits_in_snapshot"], 1)
        self.assertTrue(report["pr"]["official_delivery"])
        self.assertNotIn("alias@example.invalid", json.dumps(report))
        self.assertNotIn('"body"', json.dumps(report))
        rendered = m.markdown(report)
        self.assertIn(f"https://github.com/{REPO}/commit/{SHA}", rendered)
        self.assertIn("No es una nota ni un ranking", rendered)

    def test_empty_pr(self):
        api = FixtureAPI()
        api.commits = []
        api.pr["commits"] = 0
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(report["contributions"], [])
        self.assertEqual(report["sources"]["commits"], "disponible")

    def test_fork_desa_is_not_official_delivery(self):
        api = FixtureAPI()
        api.pr["head"]["repo"]["full_name"] = "another/course"
        self.assertFalse(m.collect(api, REPO, CONFIG, 1)["pr"]["official_delivery"])

    def test_multi_page_commits_and_deduplication(self):
        api = FixtureAPI()
        api.commits = [commit(sha=f"{i:040x}") for i in range(101)]
        api.pr["commits"] = 101
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(len(report["commits"]), 101)
        api.commits = [commit(), commit()]
        api.pr["commits"] = 2
        self.assertEqual(len(m.collect(api, REPO, CONFIG, 1)["commits"]), 1)

    def test_pr_250_limit_is_visible(self):
        api = FixtureAPI()
        api.pr["commits"] = 260
        api.commits = [commit(sha=f"{i:040x}") for i in range(250)]
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(report["sources"]["commits"], "parcial")
        self.assertTrue(report["warnings"])

    def test_api_denial_does_not_look_like_zero_reviews(self):
        api = FixtureAPI()
        api.fail = {"/reviews", "/check-runs", "/actions/runs"}
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(report["sources"]["reviews"], "parcial/no disponible")
        self.assertIn("HTTP 403", m.markdown(report))

    def test_missing_pr_still_produces_partial_report(self):
        api = FixtureAPI()
        api.fail = {"/pulls/1"}
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertNotIn("pr", report)
        self.assertIn("parcial/no disponible", m.markdown(report))

    def test_push_captures_all_commits_not_only_tip(self):
        api = FixtureAPI()
        api.commits = [commit(), commit(sha="c" * 40)]
        report = m.collect(api, REPO, CONFIG, before=BASE, after=SHA)
        self.assertEqual(len(report["commits"]), 2)

    def test_new_branch_is_marked_partial(self):
        report = m.collect(FixtureAPI(), REPO, CONFIG, before="0" * 40, after=SHA)
        self.assertIn("parcial", report["sources"]["commits"])
        self.assertEqual(len(report["commits"]), 1)

    def test_deleted_branch(self):
        report = m.collect(FixtureAPI(), REPO, CONFIG, before=SHA, after="0" * 40)
        self.assertEqual(report["commits"], [])
        self.assertIn("Rama eliminada", m.markdown(report))

    def test_review_reply_and_null_user(self):
        api = FixtureAPI()
        api.reviews = [{"id": 10, "user": None, "state": "APPROVED", "submitted_at": None,
                        "html_url": f"https://github.com/{REPO}/pull/1#pullrequestreview-10"}]
        api.comments = [{"id": 11, "user": {"login": "alice"}, "created_at": "2026-10-09T23:00:00Z",
                         "in_reply_to_id": 9, "html_url": f"https://github.com/{REPO}/pull/1#discussion_r11"}]
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(report["comments"][0]["reply_to"], 9)
        self.assertEqual(report["comments"][0]["calendar_candidate"], "2")
        self.assertEqual(report["reviews"][0]["state"], "APPROVED")

    def test_green_workflow_with_skipped_tests_stays_skipped(self):
        api = FixtureAPI()
        api.runs = [{"id": 10, "name": "CI", "head_sha": SHA, "event": "pull_request",
                     "status": "completed", "conclusion": "success", "created_at": "2026-10-09T23:00:00Z",
                     "html_url": f"https://github.com/{REPO}/actions/runs/10"}]
        api.jobs = [{"name": "backend-tests", "conclusion": "success", "status": "completed",
                     "html_url": f"https://github.com/{REPO}/actions/runs/10/job/11",
                     "steps": [{"name": "Run Pytest", "conclusion": "skipped", "status": "completed"}]}]
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertIn("Run Pytest | skipped", m.markdown(report))

    def test_secrets_and_markdown_injection_are_not_rendered(self):
        api = FixtureAPI()
        api.pr["title"] = '<script>x</script> ![x](https://evil.invalid) | token=private-test-value'
        api.commits[0]["commit"]["message"] = "ghp_SYNTHETIC_TEST_ONLY_123456"
        report = m.collect(api, REPO, CONFIG, 1)
        rendered = m.markdown(report)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn("![x]", rendered)
        self.assertNotIn("private-test-value", json.dumps(report))
        self.assertNotIn("ghp_SYNTHETIC", json.dumps(report))
        with patch.dict(os.environ, {"GH_TOKEN": "synthetic-environment-value"}):
            self.assertEqual(m.clean("synthetic-environment-value"), "[REDACTED]")

    def test_external_urls_are_rejected(self):
        for url in ["https://evil.invalid/a", "javascript:alert(1)", "https://github.com@evil.invalid/x", "https://github.com/a?token=x"]:
            self.assertEqual(m.safe_url(url), "")

    def test_invalid_repo_and_shas(self):
        for repo in ["../other", "owner/repo;touch injected"]:
            with self.assertRaises(ValueError):
                m.collect(FixtureAPI(), repo, CONFIG, 1)
        with self.assertRaises(ValueError):
            m.collect(FixtureAPI(), REPO, CONFIG, before="$(id)", after=SHA)

    def test_cli_event_to_json_and_markdown(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            event = root / "event.json"
            event.write_text(json.dumps({"pull_request": {"number": 1}}))
            summary = root / "job.md"
            with patch.object(m, "GitHub", return_value=FixtureAPI()), patch.dict(os.environ, {
                "GITHUB_EVENT_PATH": str(event), "GITHUB_STEP_SUMMARY": str(summary),
                "GITHUB_REPOSITORY": REPO,
                "GITHUB_EVENT_NAME": "",
            }), patch("sys.argv", [str(SCRIPT), "--config", str(SCRIPT.with_name("evidence-config.json")), "--output", temp]):
                m.main()
            self.assertEqual(json.loads((root / "evidence.json").read_text())["pr"]["number"], 1)
            self.assertEqual(summary.read_text(), (root / "summary.md").read_text())

    def test_aliases_aggregate_activity_without_claiming_student_identity(self):
        api = FixtureAPI()
        api.commits = [commit(), commit(sha="c" * 40, login="alice-old")]
        api.pr["commits"] = 2
        config = deepcopy(CONFIG)
        config["login_aliases"] = {"alice-old": "alice"}
        report = m.collect(api, REPO, config, 1)
        self.assertEqual(len(report["contributions"]), 1)
        self.assertEqual(report["contributions"][0]["commits_in_snapshot"], 2)
        self.assertEqual(report["contributions"][0]["kind"], "cuenta sin matrícula verificada")

    def test_api_allows_compare_but_rejects_traversal(self):
        with patch.dict(os.environ, {"GH_TOKEN": "", "GITHUB_TOKEN": ""}), patch.object(m.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = '{"commits": []}'
            self.assertEqual(m.GitHub().get(f"repos/{REPO}/compare/{BASE}...{SHA}"), {"commits": []})
            self.assertIsInstance(run.call_args.args[0], list)
        with self.assertRaises(ValueError):
            m.GitHub().get(f"repos/{REPO}/../secret")

    def test_pr_change_during_collection_is_disclosed(self):
        class MovingAPI(FixtureAPI):
            def get(self, path):
                value = super().get(path)
                if path.endswith('/pulls/1') and self.calls.count(path) > 1:
                    value['head']['sha'] = 'c' * 40
                return value
        report = m.collect(MovingAPI(), REPO, CONFIG, 1)
        self.assertTrue(any('cambió durante' in warning for warning in report['warnings']))

    def test_partial_second_page_preserves_first_page(self):
        class PartialAPI(FixtureAPI):
            def get(self, path):
                if '/commits?' in path and path.endswith('page=2'):
                    raise m.Unavailable('HTTP 429')
                return super().get(path)
        api = PartialAPI()
        api.commits = [commit(sha=f'{i:040x}') for i in range(101)]
        api.pr['commits'] = 101
        report = m.collect(api, REPO, CONFIG, 1)
        self.assertEqual(len(report['commits']), 100)
        self.assertIn('parcial', report['sources']['commits'])
        self.assertTrue(any('HTTP 429' in warning for warning in report['warnings']))

    def test_push_history_rewrite_is_disclosed(self):
        class DivergedAPI(FixtureAPI):
            def get(self, path):
                value = super().get(path)
                if '/compare/' in path:
                    value['status'] = 'diverged'
                return value
        report = m.collect(DivergedAPI(), REPO, CONFIG, before=BASE, after=SHA)
        self.assertTrue(any('divergente' in warning for warning in report['warnings']))

    def test_ci_branch_validation_uses_data_not_shell_interpolation(self):
        workflow = SCRIPT.parents[1] / '.github/workflows/ci.yml'
        if not workflow.exists():
            self.skipTest('El equipo eliminó su CI; no es un requisito del recolector independiente')
        step = workflow.read_text().split('- name: Validate delivery branches')[1].split('- name: Delivery metadata')[0]
        script = textwrap.dedent(step.split('run: |', 1)[1]).strip()
        self.assertNotIn('${{', script)
        result = subprocess.run(['bash', '-c', script], env={**os.environ, 'BASE_BRANCH': 'main', 'HEAD_BRANCH': 'desa'}, capture_output=True)
        self.assertEqual(result.returncode, 0)
        with tempfile.TemporaryDirectory() as temp:
            marker = Path(temp) / 'injected'
            result = subprocess.run(['bash', '-c', script], env={**os.environ, 'BASE_BRANCH': 'main',
                'HEAD_BRANCH': '$(touch "' + str(marker) + '")'}, capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertFalse(marker.exists())

    def test_cli_generates_at_resolution_and_labels_unmerged_closure(self):
        api = FixtureAPI()
        api.pr.update({'state': 'closed', 'closed_at': '2026-10-10T12:00:00Z'})
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            event = root / 'event.json'
            event.write_text(json.dumps({'action': 'closed', 'pull_request': {**api.pr, 'merged': False}}))
            with patch.object(m, 'GitHub', return_value=api), patch.dict(os.environ, {
                'GITHUB_EVENT_PATH': str(event), 'GITHUB_EVENT_NAME': 'pull_request',
                'GITHUB_REPOSITORY': REPO, 'GITHUB_STEP_SUMMARY': str(root / 'job.md'),
            }), patch('sys.argv', [str(SCRIPT), '--config', str(SCRIPT.with_name('evidence-config.json')), '--output', temp]):
                m.main()
            report = json.loads((root / 'evidence.json').read_text())
            self.assertEqual(report['resolution']['kind'], 'cerrado sin integrar')
            self.assertTrue(report['resolution']['head_matches_event'])
            self.assertEqual(report['resolution']['resolved_at'], '2026-10-10T12:00:00Z')
            self.assertNotIn('hours', report)

    def test_cli_does_not_collect_at_approved_review(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            event = root / 'event.json'
            event.write_text(json.dumps({'action': 'submitted', 'review': {'state': 'approved'}, 'pull_request': pr()}))
            with patch.object(m, 'GitHub') as api, patch('builtins.print'), patch.dict(os.environ, {
                'GITHUB_EVENT_PATH': str(event), 'GITHUB_EVENT_NAME': 'pull_request_review', 'GITHUB_REPOSITORY': REPO,
            }), patch('sys.argv', [str(SCRIPT), '--output', temp]):
                m.main()
                api.assert_not_called()
            self.assertFalse((root / 'summary.md').exists())


if __name__ == "__main__":
    unittest.main()

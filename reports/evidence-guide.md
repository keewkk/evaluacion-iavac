# Evidencia para Sprint Review · Práctica I

INSW220 corresponde a la asignatura homóloga de CINF100 para Computación e Informática. Esta guía conserva el flujo `desa → main` de la plantilla existente y añade una salida legible al recolector. Las métricas describen actividad observable; no generan calificaciones ni rankings.

## Qué produce

Cada captura escribe `reports/evidence/summary.md` y `reports/evidence/evidence.json`. El workflow muestra el Markdown en **Actions → ejecución → Summary** y sube ambos archivos como `devhub-evidence-<run_id>-<run_attempt>`, con retención solicitada de 90 días. GitHub puede limitar esa retención por política. Descargar la evidencia que deba conservarse después de ese plazo.

El recolector no hace commits, no comenta PR y no despliega. El directorio de salida es temporal en el runner: la evidencia se conserva mediante el artefacto, no se agrega automáticamente al historial Git.

El resumen incluye:

- PR: cuenta autora, título, presencia/tamaño de descripción, fechas, estado, ramas, SHAs, conteos de cambios y enlace para consultar el contenido original.
- Commits del PR o del rango de push: SHA, enlace, asunto, fechas Git, cuenta asociada o identidad pendiente, bot y ventana de calendario sugerida.
- Reviews: cuenta, fecha, estado y enlace. Comentarios: cuenta, fechas, enlace y `in_reply_to_id` cuando GitHub lo proporciona.
- Checks y Actions para los SHA consultados: estado, resultado, jobs y pasos técnicos. JSON conserva todos los pasos; Markdown prioriza los que mencionan tests, pytest, build, lint, ruff o deploy.
- Disponibilidad de cada fuente y advertencias de datos parciales. Una consulta fallida no se interpreta como actividad cero.
- Muestra por cuenta de commits sin merge, merges y líneas añadidas/eliminadas, con enlaces al commit y disponibilidad de estadísticas.

Las ejecuciones se vinculan por SHA; compartir SHA no demuestra que una ejecución sea exclusiva de un PR. El resultado del recolector tampoco equivale al resultado de CI. No se analizan logs para inventar cantidades de pruebas, cobertura o despliegues.

## Cuándo se actualiza

El reporte automático se genera al **resolver/cerrar un PR `desa → main` del mismo repositorio** mediante `pull_request: types: [closed]`. Se registra el desenlace: **integrado** si hubo merge o **cerrado sin integrar** si se descartó. Una review Approved, un push, un PR abierto o una sincronización no generan reportes.

Los comentarios posteriores y la finalización de otro workflow no disparan una captura nueva. La captura al cierre puede mostrar CI pendiente; no espera ni presupone éxito.

## Extraer el reporte como estudiante

1. Abrir **Actions → DevHub Evidence Collector → Run workflow**.
2. Elegir **Branch: desa** (también está disponible en main).
3. Dejar **pr_number vacío** y **report_branch: desa** para consultar el historial acumulado de desarrollo. Para una entrega específica, escribir su número de PR; en ese caso report_branch no se usa.
4. Pulsar **Run workflow**, esperar a que termine y abrir la ejecución.
5. Leer **Summary** y descargar **Artifacts → devhub-evidence-…**. Contiene `summary.md` y `evidence.json`.

Se requiere acceso de escritura al repositorio para ejecutar el workflow; integrantes con acceso de lectura pueden consultar ejecuciones y descargar artefactos. La ejecución usa recursos de GitHub Actions del repositorio.

El modo sin PR fija el SHA de la rama al comenzar y consulta hasta 1000 commits alcanzables, incluyendo entregas anteriores; excluye commits raíz de inicialización. También muestra mantenimiento institucional, que debe separarse al interpretar aportes estudiantiles. Advierte cualquier truncamiento. No compara solo cambios pendientes contra main, no agrupa automáticamente por entrega ni equivale al total de un Sprint. No consulta reviews de PR en este modo.

La resolución conserva fecha y SHA del evento junto con el estado consultado. Si el head difiere o el PR se reabre antes de consultar, el reporte advierte la incoherencia. Una recaptura manual se identifica como tal y no se presenta como la captura original de cierre.

El script se toma de la rama predeterminada y no de los cambios propuestos por un PR. Por eso debe instalarse junto con configuración y pruebas en la rama predeterminada antes de validar el flujo. En `desa` debe mantenerse una versión compatible del workflow. No usa `pull_request_target`.

## Ejecución local, solo lectura

Python 3.11+ y `gh` autenticado son suficientes; no instalar las dependencias del proyecto estudiantil ni abrir `.env`. En Actions se usa el token efímero del job, únicamente mediante una variable de entorno.

```bash
python3 scripts/evidence_report.py \
  --repo OWNER/REPOSITORY \
  --pr 4 --output /tmp/devhub-evidence-pr-4

python3 scripts/evidence_report.py \
  --repo OWNER/REPOSITORY --branch desa \
  --output /tmp/devhub-evidence-desa

python3 scripts/evidence_report.py \
  --repo OWNER/REPOSITORY --before SHA_ANTERIOR --after SHA_NUEVO \
  --output /tmp/devhub-evidence-push

python3 -m unittest discover -s scripts/tests -v
```

El rango de push usa la API compare y paginación; no depende de un checkout profundo. Una rama nueva se identifica como captura parcial del commit de punta. Un retroceso o divergencia se advierte: el reporte no reconstruye los commits retirados. Los commits repetidos se deduplican por SHA dentro de la captura. Al consolidar varias capturas hay que deduplicar de nuevo.

## Sprint y calendario

`scripts/evidence-config.json` se entrega con `windows: []` para que los repositorios futuros no hereden fechas de un semestre anterior. El docente debe definir ventanas de Sprint para su asignatura y periodo en `America/Santiago`, incluyendo inicio y cierre reales. Sin calendario, el reporte muestra la ventana sin asignar y conserva el Sprint declarado para revisión. CINF100 e INSW220 son homólogas; cada oferta debe revisar su calendario. Las fechas 2026 que aparecen en las pruebas son fixtures, no configuración académica.

El Sprint declarado se extrae de labels/milestones `Sprint 1`–`Sprint 4` y de una línea `Sprint: N` en el cuerpo. Si difieren entre sí o del calendario, la asignación queda pendiente. Para un PR se informa si la comparación usa `merged_at` o `created_at`; para cada commit, `commit.committer.date`; para reviews/comentarios, su propia fecha. No se interpreta `Hito: 1` como Sprint 1.

Declarar un Sprint no acredita que el compromiso se haya cumplido. Una entrega tardía puede pertenecer académicamente a un Sprint anterior: el docente debe resolverlo usando GesPro y el syllabus. No se genera un total acumulado por Sprint; el alcance es cada captura.

## Identidades y squash

La cuenta asociada por GitHub al autor del commit es la primera referencia. `login_aliases` permite asociar una cuenta anterior a otra; `email_aliases` resuelve correos conocidos solo cuando GitHub no entrega una cuenta. Estas tablas requieren validación docente y no deben contener credenciales; si contienen datos personales, mantenerlas en el repositorio privado con acceso adecuado. Las tablas vacías son válidas.

```json
{"login_aliases": {"cuenta-anterior": "cuenta-actual"}, "email_aliases": {}}
```

No se adivina una cuenta por nombre ni por correo institucional. Los autores sin cuenta se agrupan por una huella del correo, sin publicar el correo; si este falta se mantiene una identidad por SHA. Los bots permanecen identificados como bots. La cuenta autora del PR no recibe todos los commits del equipo. El reporte no verifica matrícula ni atribuye coautorías automáticamente.

Un squash en `main` no permite reconstruir el aporte individual por sí solo: se conserva el enlace al PR y se consultan sus commits originales. GitHub limita esa API a 250 commits; si el total no coincide se señala el recorte. Los merges se marcan en JSON. Cuentas compartidas, autores Git modificados y parejas de programación requieren evidencia complementaria.

## Muestra descriptiva de commits y líneas

El reporte muestra por cuenta y ventana de calendario: commits sin merge, merges, líneas añadidas y eliminadas, y cantidad de commits con estadísticas disponibles. La autoría se toma de cada commit, no de quien abrió el PR. Los aliases configurados se consolidan; bots e identidades pendientes se identifican por separado.

Para cada commit sin merge se consulta `GET /repos/{owner}/{repo}/commits/{sha}` y se conservan únicamente `stats.additions` y `stats.deletions`, SHA y metadatos seleccionados. No se guardan patches ni contenido de archivos. Se deduplican SHA antes de consultar o sumar. Los merges se cuentan aparte y no aportan líneas a la cuenta que hizo merge.

Las cantidades individuales son **cambios textuales acumulados**, no líneas de código original escrito ni líneas que permanecen en la entrega. Pueden incluir documentación, pruebas, configuración, archivos generados, dependencias, reformateos y reversiones. Una modificación puede contar como una eliminación y una adición. Los binarios no tienen una medida equivalente de líneas; los ceros del API describen solo sus estadísticas textuales.

Los cambios netos del PR se muestran por separado. La suma por commit puede ser mayor: añadir algo y luego modificarlo o borrarlo vuelve a producir cambios. El reporte no calcula porcentajes de rendimiento, rankings, calificaciones ni tiempo. El dato se presenta como muestra para que el docente abra y revise la evidencia original.

Si falta alguna consulta de estadísticas, la fila muestra **N/D**, el número de commits con datos y los subtotales observados en JSON. Una fuente faltante no se interpreta como cero. Si el historial del PR fue recortado por el límite REST de 250 commits, la muestra queda señalada como parcial; no se presenta como total de todo el Sprint.

El formato JSON actual es `schema_version: 3`; no calcula ni incluye estimaciones de horas o registros de tiempo. La propuesta anterior se conserva fuera de los checkouts, en `history/hour-prototype/`, como referencia histórica. La generación automática al cierre del PR permanece vigente.

## Señal de uso del inglés

Se analizan por separado título y cuerpo del PR y mensaje completo de cada commit. Se excluyen bloques con triple acento grave, URLs y etiquetas HTML. No se analiza documentación, código, imágenes ni conversaciones. El cuerpo incluye instrucciones de la plantilla y checklists; el resultado puede reflejar ese texto heredado.

El método `léxico v1` cuenta palabras de dos vocabularios pequeños:

- Inglés: `the with and for this add fix update tests implement feature build`.
- Español: `el la los las con para del se añadir pruebas función entrega`.

Con menos de tres coincidencias en ambos vocabularios: indeterminado. Con tres o más en ambos: mixto. En los demás casos se informa la señal del vocabulario con coincidencias. Los conteos están en JSON. Esta heurística es transparente y limitada: no es una detección de idioma validada, una evaluación de dominio ni una dimensión de desempeño individual. La inspección docente del artefacto original sigue siendo necesaria.

## Seguridad, límites y evidencia complementaria

Permisos: `contents`, `pull-requests`, `actions` y `checks`, todos de lectura. No recibe secretos institucionales ni descarga adjuntos. Ejecuta el recolector y sus pruebas desde la rama predeterminada; no ejecuta la aplicación ni sus pruebas o dependencias. El shell recibe inputs como variables de entorno; el contenido del PR se procesa como datos JSON. El Markdown escapa contenido y restringe enlaces a GitHub; se omiten cuerpos de PR/comentarios, patches, logs y correos personales. Se redacta el token de entorno y patrones conocidos en textos seleccionados. Esto no sustituye una política de prevención de secretos en el repositorio.

Reviews históricas no equivalen al conjunto de aprobaciones vigentes; se muestra su estado, incluido `DISMISSED`. REST permite relacionar algunas respuestas mediante `in_reply_to_id`, pero aquí no se consulta el estado resuelto de los hilos ni se calculan tiempos de resolución.

Las consultas se paginan con límites explícitos; para CI se detallan hasta 20 ejecuciones por SHA. Se advierten fallos, truncamientos y cambios del PR durante la consulta. No es una captura transaccional de todas las APIs. No se recopilan statuses legacy, Deployments ni OpenProject. Un step exitoso puede contener comandos condicionales o `--if-present`; solo sus logs y resultados de pruebas podrían demostrar qué se ejecutó realmente.

Para evaluar Scrum: backlog, paquetes, responsables, compromisos, worklogs y retrospectiva de GesPro. Para calidad: demo, criterios de aceptación, pruebas/cobertura y revisión técnica. Para desempeño individual: explicación, defensa y trazabilidad de responsabilidades. Para IA/investigación: fuentes, experimentos, decisiones y validación de lo generado. El reporte aporta enlaces; la evaluación integra esas evidencias.

## Instalación

El paquete se instala en main y desa. Incluye `reporting.yml`, `scripts/evidence_report.py`, `scripts/delivery_context.py`, `scripts/evidence-config.json`, los tres archivos de `scripts/tests/` y esta guía. Si existe el CI institucional, se corrige la interpolación de ramas conservando sus jobs. El reporte funciona también cuando el equipo eliminó el CI del proyecto; la ausencia de CI no demuestra que haya pruebas ejecutadas.

Una review Approved no genera reporte; el cierre con o sin merge genera la captura de resolución. Los PR de fork se excluyen del disparo automático de entrega oficial. Actualizar la plantilla por sí sola no actualiza repositorios ya generados ni manifiestos guardados por curso en el Integrador.

Referencias oficiales: [eventos](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [artefactos](https://docs.github.com/en/actions/tutorials/store-and-share-data), [commits de PR](https://docs.github.com/en/rest/pulls/pulls#list-commits-on-a-pull-request), [comentarios y permisos](https://docs.github.com/en/rest/issues/comments#list-issue-comments), [seguridad de workflows](https://docs.github.com/en/actions/reference/security/secure-use).

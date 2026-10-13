# Reportería CINF100

Esta carpeta almacena reportes derivados de las plataformas
utilizadas durante el proyecto.

## Fuentes

- OpenProject / GesPro
- GitHub
- GitHub Actions
- CI/CD

## Estructura sugerida

reports/
├── sprint-01/
│   ├── team-summary.csv
│   ├── individual-summary.csv
│   ├── commits-desa.csv
│   ├── pr-desa-main.json
│   └── ci-summary.json
│
├── sprint-02/
│   └── ...
│
└── final/
    ├── assessment.csv
    ├── individual-performance.csv
    └── course-summary.csv

## Principio

Los reportes constituyen evidencia objetiva para la evaluación.

No reemplazan el juicio académico del docente.

## Reporte de evidencia DevHub

Consultar la [guía de evidencia](evidence-guide.md). Actions → DevHub Evidence Collector → Run workflow permite extraer el historial de desa sin indicar PR, o recapturar una entrega por número de PR. Summary y artefacto Markdown/JSON; muestra descriptiva de commits y líneas, sin estimar horas.

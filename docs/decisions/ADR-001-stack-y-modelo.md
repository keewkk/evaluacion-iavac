# ADR-001 - Stack tecnico y modelo de datos inicial para R1

## Estado

Aceptada

## Contexto

El equipo fue reasignado desde el proyecto "Reservas Viajes UNAB" al proyecto
"Evaluacion IA VAC" (Vicerrectoria de Aseguramiento de la Calidad). En el
proyecto anterior se habia usado Node/Express + SQLite en vez del stack
oficial del ramo, lo cual quedo como una desviacion sin documentar.

Para este nuevo proyecto se dispone de la plantilla `DemoPracticas` entregada
en clase, que muestra el stack de referencia: React + FastAPI + MySQL,
orquestado con Docker Compose y validado con un pipeline de GitHub Actions.

## Alternativas consideradas

1. Repetir el stack usado en "Reservas Viajes UNAB" (Node/Express + SQLite),
   ya conocido por el equipo.
2. Adoptar el stack de la plantilla oficial `DemoPracticas` (React + FastAPI
   + MySQL + Docker + GitHub Actions).

## Decision

Se adopta la alternativa 2: React + FastAPI + MySQL + Docker + GitHub Actions,
siguiendo la estructura de la plantilla `DemoPracticas` provista por el ramo.

## Justificacion

- Es el stack de referencia validado por el docente/ramo, evitando repetir la
  observacion de desviacion del proyecto anterior.
- La plantilla ya trae un pipeline de CI/CD funcional (build backend, build
  frontend, build de imagenes Docker, prueba de integracion), que se adapto
  directamente para este proyecto.
- FastAPI facilita la validacion de datos (Pydantic) y la documentacion
  automatica (Swagger en `/docs`), util para un dominio con varias entidades
  relacionadas (Instrumento - Criterio - Documento).

## Consecuencias

### Positivas

- Consistencia con el stack esperado por el ramo.
- CI/CD ya armado desde el Sprint 1, no hay que agregarlo despues.
- Documentacion interactiva de la API gratis (Swagger/OpenAPI).

### Negativas

- El equipo debe familiarizarse con Python/FastAPI si su experiencia previa
  era mas fuerte en Node.js.

### Riesgos

- El modelo de datos (Instrumento, Criterio, Documento) es un borrador armado
  antes del kickoff con el docente/contraparte. Puede requerir cambios una vez
  se confirme la politica real de documentos y criterios de evaluacion.

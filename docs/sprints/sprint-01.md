# Sprint 1 - M1 Instrumentos y carga documental

## Objetivo del Sprint

Dejar definido el alcance del modulo M1 (Evaluacion IA VAC) junto al
docente/contraparte, y construir la base tecnica: modelo de datos de
Instrumentos/Criterios/Documentos y un CRUD funcional minimo sobre ese
modelo (backend + frontend + base de datos, todo en Docker).

## Periodo

Inicio: 2026-09-17

Fin: (definir con el calendario ajustado del ramo, considerando que el
equipo viene retrasado por el cambio de proyecto desde "Reservas Viajes
UNAB")

## Paquetes de trabajo comprometidos

| OpenProject | Descripcion | Responsable | Estado |
|---|---|---|---|
| - | Configuracion y alcance: kickoff con el docente, definir alcance real de M1 | Equipo completo | Hecho - kickoff realizado, backlog M1/M2/M3 confirmado |
| - | Modelo base: entidades Instrumento, Criterio, Documento + CRUD basico | Julian (backend) + equipo | Hecho |
| - | Configuracion de instrumentos de evaluacion (historia M1) | Julian (backend) + equipo | En progreso |
| - | Carga documental (historia M1) | Julian (backend) + equipo | En progreso |

## Resultado

Se construyo un prototipo funcional con:

- Backend FastAPI con endpoints CRUD para Instrumentos (con sus Criterios) y
  Documentos (carga de archivos con asociacion opcional a un Instrumento).
- Frontend React con vistas de gestion de Instrumentos y carga de
  Documentos (dashboard, tablas, preview/descarga de archivos).
- Base de datos MySQL con el esquema inicial (`database/init.sql`).
- Stack completo levantable con `docker compose up --build`.
- Pipeline de CI/CD en GitHub Actions (build backend, build frontend, build
  de imagenes, prueba de integracion del stack completo).
- Base tecnica de M3 (trazabilidad): tabla `logs_auditoria` + endpoint
  `GET /api/logs`, registrando cada creacion/edicion/borrado/carga/
  asociacion/preevaluacion.
- Base tecnica de M2 (preevaluacion IA): `ia_service.py` (cliente generico
  compatible con Qwen/Gemma via variables de entorno), endpoint
  `POST /api/documentos/{id}/preevaluar` y `GET /.../preevaluaciones`.
  Probado end-to-end con un servidor mock; queda a la espera de las API
  keys reales de la universidad (ver ADR-002).

## Demo

Pendiente de grabar/mostrar.

## Problemas y bloqueos

- Las API keys de IA (Qwen/Gemma) de parte de la universidad aun no llegan;
  el backend esta listo para recibirlas sin cambios de codigo (`.env`), pero
  no se puede probar contra el modelo real todavia.
- Falta implementar en el frontend la UI de logs (M3) y de preevaluacion IA
  (M2); por ahora solo existen los endpoints de backend.
- Feedback recibido de que el diseno del frontend era "muy basico" - se
  revisa el estado actual y se sigue iterando sobre el mismo dashboard
  (no se identifico una version efectivamente basica en el repo actual; si
  el feedback apuntaba a algo especifico, falta que el equipo lo confirme
  con el docente para no perder tiempo redisenando algo que no corresponde).

## Metricas

- Work Packages comprometidos: 4 (Configuracion y alcance, Modelo base,
  Configuracion de instrumentos, Carga documental)
- Work Packages terminados: 2 (Configuracion y alcance, Modelo base)
- Commits en `desa`: (completar al subir a GitHub)
- PR `desa -> main`: (completar)
- Tests: pendiente (no se agregaron tests automatizados este sprint)
- Builds exitosos: (completar tras primer push, revisar pestana Actions)
- Incidencias: cambio de proyecto asignado a mitad de semestre

## Retrospectiva

### Mantener

- Documentar decisiones de stack y diseno antes de programar (ver ADR-001 y
  ADR-002), a diferencia del proyecto anterior.
- Disenar la integracion de IA de forma generica (variables de entorno) para
  no bloquearse mientras no llegan las credenciales.

### Mejorar

- Confirmar con el docente el alcance especifico del feedback sobre el
  frontend, para no invertir tiempo redisenando algo que ya cumple.
- Agregar tests basicos al backend.

### Acciones siguientes

- Completar la UI de M2 (boton "Preevaluar con IA" + vista de resultado) y
  M3 (vista de logs) en el frontend.
- Cargar `.env` con las API keys apenas la universidad las entregue.
- Agregar tests basicos al backend.

# Evaluacion IA VAC - Modulo R1 (Instrumentos y carga documental)

Proyecto de Practica I (CINF100) - Software Factory Academica UNAB DevHub.

## Contexto

Cliente: Vicerrectoria de Aseguramiento de la Calidad (VAC), Universidad Andres Bello.

El proyecto completo busca apoyar la evaluacion de informacion institucional
(evidencias, informes, documentos de acreditacion) con ayuda de IA: un primer
analisis automatico y luego revision humana. Se divide en 3 modulos:

- **M1 - Instrumentos y carga documental** (base de este repo): configurar
  rubricas/pautas de evaluacion y cargar los documentos evaluables.
- **M2 - Preevaluacion asistida por IA** (Qwen / Gemma): analisis automatico
  de un documento contra los criterios de un instrumento.
- **M3 - Trazabilidad y reportes**: log de auditoria de cada cambio relevante
  (ya incluido desde este sprint) y reportes/calibracion (pendiente).

Confirmado en el kickoff: al equipo le corresponden las historias
"Configuracion de instrumentos de evaluacion" y "Carga documental" de M1.
El backend ya deja lista, ademas, la base tecnica de M2 (preevaluacion IA) y
parte de M3 (logs de auditoria), para no tener que retro-instrumentar despues.

## Stack

Se usa el stack de referencia del ramo (mismo que la plantilla `DemoPracticas`
entregada en clase):

- **Frontend**: React (servido con Nginx en produccion)
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Base de datos**: MySQL 8
- **Contenedores**: Docker + Docker Compose
- **CI/CD**: GitHub Actions (`.github/workflows/workflow.yml`)

## Estructura

```
.
├── docker-compose.yml
├── .env.example       # variables de IA (Qwen/Gemma) - copiar a .env
├── backend/          # API FastAPI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py        # endpoints
│       ├── models.py      # tablas SQLAlchemy
│       ├── schemas.py     # esquemas Pydantic
│       └── ia_service.py  # cliente Qwen/Gemma (M2)
├── frontend/         # SPA en React
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── database/
│   └── init.sql      # esquema SQL, se ejecuta al crear el contenedor de MySQL
├── uploads/           # archivos cargados (montado como volumen)
└── docs/
    ├── decisions/     # ADRs
    └── sprints/       # bitacora de cada sprint
```

## Modelo de datos

- **Instrumento**: rubrica/pauta de evaluacion (nombre, descripcion, version, estado).
- **Criterio**: item evaluable dentro de un instrumento (descripcion, puntaje maximo).
- **Documento**: archivo evaluable cargado al sistema, opcionalmente asociado a un
  instrumento (nombre, tipo, ruta, estado: CARGADO / ASOCIADO).
- **Preevaluacion** (M2): resultado (o error) de correr un Documento + su
  Instrumento contra el modelo de IA elegido (Qwen o Gemma).
- **LogAuditoria** (M3): registro inmutable de cada creacion/edicion/borrado/
  carga/asociacion/preevaluacion, consultable desde `/api/logs`.

Ver `docs/decisions/ADR-001-stack-y-modelo.md` para el stack y modelo base, y
`docs/decisions/ADR-002-logs-y-ia.md` para el diseno de logs y la integracion
de IA. `docs/sprints/sprint-01.md` tiene el objetivo y alcance del sprint.

## API (resumen)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET/POST | `/api/instrumentos` | Listar / crear instrumentos (con criterios) |
| GET/PUT/DELETE | `/api/instrumentos/{id}` | Detalle / editar / eliminar |
| GET/POST | `/api/documentos` | Listar / subir documentos |
| GET | `/api/documentos/{id}/archivo` | Ver o descargar el archivo |
| PUT | `/api/documentos/{id}/asociar` | Asociar documento a un instrumento |
| DELETE | `/api/documentos/{id}` | Eliminar documento |
| POST | `/api/documentos/{id}/preevaluar` | Generar preevaluacion IA (Qwen/Gemma) |
| GET | `/api/documentos/{id}/preevaluaciones` | Historial de preevaluaciones del documento |
| GET | `/api/logs` | Log de auditoria (filtro opcional `?entidad=`) |

Swagger interactivo disponible en `http://localhost:8002/docs`.

## Integracion IA (Qwen / Gemma)

`POST /api/documentos/{id}/preevaluar` llama a `backend/app/ia_service.py`,
que habla con cualquier endpoint compatible con la API de OpenAI
(`/chat/completions`) - asi sirve tanto para Qwen como para Gemma sin cambiar
codigo, solo variables de entorno:

```
IA_API_URL=https://<endpoint-u>/v1
IA_API_KEY=<api key entregada por la universidad>
IA_MODEL_QWEN=<nombre exacto del modelo en ese endpoint>
IA_MODEL_GEMMA=<nombre exacto del modelo en ese endpoint>
```

**Mientras la universidad no entregue las API keys** (`nos iban a dar las
api keys de la u`, aun pendiente), el endpoint responde `503` con un mensaje
claro ("IA todavia no configurada") en vez de fallar sin explicacion, y el
intento queda igual registrado en `/api/logs`. Copiar `.env.example` a `.env`
y completarlo apenas lleguen las credenciales - no hace falta tocar codigo.

## Como correr el proyecto

Requisitos: Docker y Docker Compose instalados.

```bash
docker compose up --build
```

Esto levanta 3 contenedores:

| Servicio | URL                          | Descripcion                        |
|----------|------------------------------|-------------------------------------|
| frontend | http://localhost:3002        | Interfaz React                      |
| backend  | http://localhost:8002/docs   | Documentacion interactiva (Swagger) |
| db       | localhost:3308                | MySQL (usuario: `vac_user`)        |

Para detener todo:

```bash
docker compose down
```

Para borrar tambien los datos persistidos de MySQL:

```bash
docker compose down -v
```

## Pendiente

- API keys de IA de parte de la universidad (Qwen/Gemma) - backend ya listo
  para recibirlas via `.env`, sin cambios de codigo.
- UI de M2 (boton "Preevaluar con IA" y vista de resultados) y de M3 (vista
  de logs) en el frontend - en desarrollo.
- Autenticacion/roles de usuario (por ahora no hay login).
- Definir con la contraparte politica de confidencialidad de los documentos
  cargados antes de enviarlos a un proveedor externo de IA.

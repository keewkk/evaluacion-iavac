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
| GET | `/api/preevaluaciones/ultimas` | Ultima evaluacion completada de cada documento |
| GET | `/api/ia/estado` | Consultar el estado de configuracion (sin revelar la credencial) |
| POST | `/api/ia/probar` | Probar una llamada real al modelo seleccionado |
| GET | `/api/instrumentos/{id}/prompt` | Ver el prompt construido desde los criterios de una pauta |
| GET | `/api/logs` | Log de auditoria (filtro opcional `?entidad=`) |

Cada archivo cargado puede pesar hasta **50 MB**. La interfaz y la API validan
el límite y la API responde con HTTP 413 si se supera. Este límite corresponde
al almacenamiento del archivo, no a la capacidad del modelo: antes de llamar a
la IA, el backend extrae texto de PDF, DOCX, TXT y MD y actualmente limita el
contenido enviado a **12.000 caracteres**. El proveedor/modelo configurado puede
tener además su propio límite de contexto.

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

El backend usa `Authorization: Bearer` y valida la respuesta antes de guardar
una preevaluacion. Si faltan variables responde `503`; si el proveedor no
responde o devuelve un error, la preevaluacion queda registrada como fallida
y se informa el error sin exponer la credencial. Desde **Admin LLM** se puede
consultar el estado, probar una conexion real y ver el prompt generado desde
los criterios y puntajes maximos de una pauta. El texto de la pauta se manda
como dato a evaluar y el resultado debe incluir todos sus criterios.

Cada preevaluacion completada conserva su puntaje, resumen y justificacion por
criterio en la base de datos. En la lista de documentos se muestra la ultima
puntuacion y el boton **Ver informe** abre el desglose guardado; se puede
consultar el historial completo desde esa misma ventana.

Las credenciales se configuran en `.env` y se pasan al backend mediante
Docker Compose. Si se modifica ese archivo con los contenedores ya iniciados,
vuelve a ejecutar `docker compose up -d` para recrear el backend con los
valores actuales; no incluyas ni compartas el contenido de `.env`.

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
- Vista de administracion de IA, prueba de conexion y constructor/preview del
  prompt integrados en el frontend.
- Autenticacion/roles de usuario (por ahora no hay login).
- Definir con la contraparte politica de confidencialidad de los documentos
  cargados antes de enviarlos a un proveedor externo de IA.

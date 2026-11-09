# ADR-002 - Log de auditoria y diseno de la integracion IA (M2/M3)

## Estado

Aceptada

## Contexto

Tras el kickoff se confirmo el backlog completo de "Evaluacion IA VAC"
(M1/M2/M3) y llego feedback puntual sobre el prototipo de R1:

- El equipo debe entregar M1 (Configuracion de instrumentos + Carga
  documental), pero conviene dejar la base tecnica de M2 (preevaluacion IA)
  y de M3 (trazabilidad) lista desde ya, para no retrabajar el modelo de
  datos ni las relaciones mas adelante.
- Se debe guardar en base de datos un log de cada cambio relevante
  (creacion/edicion/borrado de instrumentos, carga/asociacion/borrado de
  documentos), no solo mantenerlo en memoria o en logs de servidor.
- El modulo M2 debe usar los modelos Qwen y Gemma. A la fecha de este ADR
  las API keys de la universidad todavia no han sido entregadas.

## Decision

### Log de auditoria (M3)

Se agrega una tabla `logs_auditoria` (modelo `LogAuditoria`) con columnas
`entidad`, `entidad_id`, `accion` (enum: CREAR/ACTUALIZAR/ELIMINAR/CARGAR/
ASOCIAR/PREEVALUAR), `detalle` y `creado_en`. Un helper `registrar_log()` se
llama desde cada endpoint que muta datos (instrumentos y documentos), y se
expone `GET /api/logs` (con filtro opcional por `entidad`) para consultarlo.
Es un registro solo de escritura (no hay endpoint de edicion/borrado de
logs), consistente con el requisito de trazabilidad.

### Integracion IA (M2)

En vez de escribir un cliente especifico para Qwen y otro para Gemma, se
disena `backend/app/ia_service.py` generico, contra la API de
`/chat/completions` compatible con OpenAI (el formato que exponen la mayoria
de los gateways que sirven estos modelos - vLLM, Ollama, endpoints propios de
universidades, etc.). El modelo a usar (`qwen` o `gemma`) se elige por
parametro en `POST /api/documentos/{id}/preevaluar`, y el nombre real de cada
modelo en el endpoint de la universidad se configura por variable de entorno
(`IA_MODEL_QWEN` / `IA_MODEL_GEMMA`), no hardcodeado.

Como las API keys todavia no llegan, se opta por: el servicio funciona sin
ellas (no rompe el arranque del backend), y al intentar preevaluar sin
configurar devuelve `503` con un mensaje explicito
(`IANoConfiguradaError`), dejando igual un registro en el log de auditoria
del intento. Apenas lleguen las credenciales, solo hay que completar
`.env` (ver `.env.example`) - no se requieren cambios de codigo.

Se agrega tambien extraccion de texto de documentos (`.txt`, `.md`, `.pdf`
via `pypdf`, `.docx` via `python-docx`) como paso previo a construir el
prompt que se envia al modelo, truncando a un maximo de caracteres para
evitar prompts excesivos.

## Consecuencias

### Positivas

- El modelo de datos de M1 (Instrumento/Criterio/Documento) no necesita
  cambios cuando se implemente M2/M3 en profundidad; solo se le agregan
  tablas relacionadas.
- El backend queda demostrable end-to-end aunque las API keys no hayan
  llegado (se probo con un servidor mock compatible con OpenAI).
- Cambiar de proveedor de IA (o agregar un tercer modelo) es, en principio,
  solo una variable de entorno mas.

### Negativas / riesgos

- El formato exacto del endpoint de IA que entregue la universidad podria no
  ser 100% compatible con `/chat/completions` de OpenAI; si es asi,
  `ia_service.py` va a necesitar un ajuste puntual (no un rediseno).
- La extraccion de texto no soporta todavia documentos escaneados como
  imagen (PDF sin capa de texto) ni hojas de calculo.
- Falta definir con la VAC la politica de confidencialidad antes de enviar
  documentos institucionales a un proveedor de IA externo.

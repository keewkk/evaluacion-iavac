"""Cliente de IA para la preevaluacion asistida (modulo M2).

R1 deja la base lista (instrumentos + documentos asociados); este modulo
conecta con el modelo real en cuanto la universidad entregue las API keys.
Se disenio generico (API compatible con OpenAI /chat/completions) porque
tanto Qwen como Gemma se sirven habitualmente detras de un endpoint de ese
tipo (vLLM, Ollama, Together, etc.) — solo hay que completar las variables
de entorno cuando lleguen las credenciales:

    IA_API_URL   -> ej: https://<endpoint-u>/v1
    IA_API_KEY   -> la api key que entregue la universidad
    IA_MODEL_QWEN  -> nombre exacto del modelo Qwen en ese endpoint
    IA_MODEL_GEMMA -> nombre exacto del modelo Gemma en ese endpoint

Mientras esas variables no esten seteadas, generar_preevaluacion lanza
IANoConfiguradaError con un mensaje claro (el endpoint HTTP lo traduce a un
503 legible en vez de fallar feo).
"""

import json
import os
from dataclasses import dataclass

import httpx

from . import schemas

IA_API_URL = os.getenv("IA_API_URL", "").rstrip("/")
IA_API_KEY = os.getenv("IA_API_KEY", "")
MODELOS = {
    "qwen": os.getenv("IA_MODEL_QWEN", "qwen2.5-72b-instruct"),
    "gemma": os.getenv("IA_MODEL_GEMMA", "gemma-2-27b-it"),
}


class IANoConfiguradaError(Exception):
    pass


class ExtraccionTextoError(Exception):
    pass


@dataclass
class DocumentoTexto:
    texto: str
    truncado: bool


def esta_configurada() -> bool:
    return bool(IA_API_URL and IA_API_KEY)


def extraer_texto(ruta_archivo: str, max_chars: int = 12000) -> DocumentoTexto:
    """Extrae texto plano de un documento para pasarlo al modelo.

    Soporta .txt/.md de forma directa; .pdf y .docx si las librerias
    correspondientes estan instaladas (ver requirements.txt). Otros formatos
    (imagenes, hojas de calculo) todavia no se soportan aqui.
    """
    ext = os.path.splitext(ruta_archivo)[1].lower()

    if ext in (".txt", ".md"):
        with open(ruta_archivo, "r", encoding="utf-8", errors="ignore") as f:
            texto = f.read()
    elif ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise ExtraccionTextoError(
                "Falta la libreria pypdf para leer PDFs (agregala a requirements.txt)."
            ) from e
        reader = PdfReader(ruta_archivo)
        texto = "\n".join((page.extract_text() or "") for page in reader.pages)
    elif ext == ".docx":
        try:
            import docx
        except ImportError as e:
            raise ExtraccionTextoError(
                "Falta la libreria python-docx para leer Word (agregala a requirements.txt)."
            ) from e
        doc = docx.Document(ruta_archivo)
        texto = "\n".join(p.text for p in doc.paragraphs)
    else:
        raise ExtraccionTextoError(
            f"Tipo de archivo '{ext}' todavia no soportado para preevaluacion automatica."
        )

    texto = texto.strip()
    if not texto:
        raise ExtraccionTextoError(
            "No se pudo extraer texto del documento (¿esta escaneado como imagen?)."
        )

    truncado = len(texto) > max_chars
    return DocumentoTexto(texto=texto[:max_chars], truncado=truncado)


def _construir_prompt(texto_documento: str, criterios: list) -> str:
    criterios_txt = "\n".join(
        f'- id={c.id}: "{c.descripcion}" (puntaje maximo: {c.puntaje_max})'
        for c in criterios
    )
    return f"""Eres un asistente de apoyo a la evaluacion de calidad institucional.
Evalua el siguiente documento contra cada criterio de la rubrica. Para cada
criterio entrega un puntaje (numero, puede ser decimal, entre 0 y el puntaje
maximo del criterio) y una justificacion breve basada solo en el contenido
del documento. Esto es una PREEVALUACION: un evaluador humano la revisara y
puede ajustarla, asi que se conservador y explica tu razonamiento.

Responde EXCLUSIVAMENTE con JSON valido, sin texto adicional, con esta forma:
{{
  "criterios": [
    {{"criterio_id": <int>, "puntaje": <numero>, "justificacion": "<texto>"}}
  ],
  "resumen": "<1-2 frases con la impresion general>"
}}

Criterios de la rubrica:
{criterios_txt}

Documento a evaluar:
\"\"\"
{texto_documento}
\"\"\"
"""


def generar_preevaluacion(
    ruta_archivo: str, instrumento, modelo: str = "qwen"
) -> schemas.ResultadoPreevaluacion:
    if not esta_configurada():
        raise IANoConfiguradaError(
            "La integracion con el modelo de IA todavia no esta configurada "
            "(faltan IA_API_URL / IA_API_KEY). Pendiente de la API key que "
            "entrega la universidad."
        )

    nombre_modelo = MODELOS.get(modelo, MODELOS["qwen"])
    doc_texto = extraer_texto(ruta_archivo)
    prompt = _construir_prompt(doc_texto.texto, instrumento.criterios)

    respuesta = httpx.post(
        f"{IA_API_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {IA_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": nombre_modelo,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        },
        timeout=60.0,
    )
    respuesta.raise_for_status()
    data = respuesta.json()
    contenido = data["choices"][0]["message"]["content"]

    try:
        parsed = json.loads(contenido)
    except (json.JSONDecodeError, KeyError) as e:
        raise ExtraccionTextoError(
            f"El modelo no devolvio JSON valido: {contenido[:300]}"
        ) from e

    por_id = {c.id: c for c in instrumento.criterios}
    criterios_resultado = []
    puntaje_total = 0.0
    for item in parsed.get("criterios", []):
        crit = por_id.get(item.get("criterio_id"))
        if crit is None:
            continue
        puntaje = float(item.get("puntaje", 0))
        criterios_resultado.append(
            schemas.CriterioResultado(
                criterio_id=crit.id,
                descripcion=crit.descripcion,
                puntaje=puntaje,
                puntaje_max=crit.puntaje_max,
                justificacion=item.get("justificacion", ""),
            )
        )
        puntaje_total += puntaje

    resumen = parsed.get("resumen", "")
    if doc_texto.truncado:
        resumen = (resumen + " (documento truncado para el analisis)").strip()

    return schemas.ResultadoPreevaluacion(
        criterios=criterios_resultado,
        puntaje_total=puntaje_total,
        resumen=resumen,
    )

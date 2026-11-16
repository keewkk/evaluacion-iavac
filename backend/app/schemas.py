from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict


class EstadoInstrumento(str, Enum):
    BORRADOR = "BORRADOR"
    PUBLICADO = "PUBLICADO"


class EstadoDocumento(str, Enum):
    CARGADO = "CARGADO"
    ASOCIADO = "ASOCIADO"


class AccionLog(str, Enum):
    CREAR = "CREAR"
    ACTUALIZAR = "ACTUALIZAR"
    ELIMINAR = "ELIMINAR"
    CARGAR = "CARGAR"
    ASOCIAR = "ASOCIAR"
    PREEVALUAR = "PREEVALUAR"
    ANALIZAR = "ANALIZAR"


class EstadoPreevaluacion(str, Enum):
    PENDIENTE = "PENDIENTE"
    COMPLETADA = "COMPLETADA"
    ERROR = "ERROR"


# ---- Criterio ----

class CriterioBase(BaseModel):
    descripcion: str
    orden: int = 0
    puntaje_max: int = 5


class CriterioCreate(CriterioBase):
    pass


class CriterioOut(CriterioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---- Instrumento ----

class InstrumentoBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    version: str = "1.0"
    estado: EstadoInstrumento = EstadoInstrumento.BORRADOR


class InstrumentoCreate(InstrumentoBase):
    criterios: list[CriterioCreate] = []


class InstrumentoUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    version: str | None = None
    estado: EstadoInstrumento | None = None


class InstrumentoOut(InstrumentoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    creado_en: datetime | None = None
    criterios: list[CriterioOut] = []


# ---- Carpeta ----

class CarpetaBase(BaseModel):
    nombre: str
    descripcion: str | None = None


class CarpetaCreate(CarpetaBase):
    pass


class CarpetaUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None


class DocumentoEnCarpeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    tipo: str | None = None
    ruta_archivo: str
    instrumento_id: int | None = None
    estado: EstadoDocumento
    cargado_en: datetime | None = None


class CarpetaOut(CarpetaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ultimo_informe: str | None = None
    analizado_en: datetime | None = None
    creado_en: datetime | None = None
    documentos_count: int = 0
    documentos: list[DocumentoEnCarpeta] = []


class AnalisisCarpetaOut(BaseModel):
    carpeta_id: int
    carpeta_nombre: str
    total_documentos: int
    informe_disponible: bool = True
    descargar_url: str
    resumen_ejecutivo: str
    ejes_tematicos: list[dict] = []
    hallazgos_clave: list[str] = []
    alertas_discrepancias: list[str] = []
    recomendaciones: list[dict] = []


# ---- Documento ----

class DocumentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    tipo: str | None = None
    ruta_archivo: str
    instrumento_id: int | None = None
    carpeta_id: int | None = None
    estado: EstadoDocumento
    cargado_en: datetime | None = None


class DocumentoAsociar(BaseModel):
    instrumento_id: int


class DocumentoAsociarCarpeta(BaseModel):
    carpeta_id: int | None = None


# ---- Preevaluacion (M2 - IA) ----

class CriterioResultado(BaseModel):
    criterio_id: int
    descripcion: str
    puntaje: float
    puntaje_max: int
    justificacion: str


class ResultadoPreevaluacion(BaseModel):
    criterios: list[CriterioResultado] = []
    puntaje_total: float | None = None
    resumen: str | None = None


class PreevaluacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    documento_id: int
    instrumento_id: int
    modelo: str
    estado: EstadoPreevaluacion
    resultado: ResultadoPreevaluacion | None = None
    error: str | None = None
    creado_en: datetime | None = None


class PreevaluarRequest(BaseModel):
    modelo: Literal["qwen", "gemma"] = "qwen"


# ---- Log de auditoria (M3 - trazabilidad) ----

class LogAuditoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entidad: str
    entidad_id: int | None = None
    accion: AccionLog
    detalle: str | None = None
    creado_en: datetime | None = None

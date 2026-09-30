from datetime import datetime
from enum import Enum

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


# ---- Documento ----

class DocumentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    tipo: str | None = None
    ruta_archivo: str
    instrumento_id: int | None = None
    estado: EstadoDocumento
    cargado_en: datetime | None = None


class DocumentoAsociar(BaseModel):
    instrumento_id: int


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
    modelo: str = "qwen"  # "qwen" | "gemma"


# ---- Log de auditoria (M3 - trazabilidad) ----

class LogAuditoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entidad: str
    entidad_id: int | None = None
    accion: AccionLog
    detalle: str | None = None
    creado_en: datetime | None = None

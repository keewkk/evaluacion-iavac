import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Enum,
    ForeignKey,
    TIMESTAMP,
    JSON,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


class EstadoInstrumento(str, enum.Enum):
    BORRADOR = "BORRADOR"
    PUBLICADO = "PUBLICADO"


class EstadoDocumento(str, enum.Enum):
    CARGADO = "CARGADO"
    ASOCIADO = "ASOCIADO"


class AccionLog(str, enum.Enum):
    CREAR = "CREAR"
    ACTUALIZAR = "ACTUALIZAR"
    ELIMINAR = "ELIMINAR"
    CARGAR = "CARGAR"
    ASOCIAR = "ASOCIAR"
    PREEVALUAR = "PREEVALUAR"


class EstadoPreevaluacion(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    COMPLETADA = "COMPLETADA"
    ERROR = "ERROR"


class Instrumento(Base):
    """Rubrica / pauta de evaluacion (R1 - Instrumentos y carga documental)."""

    __tablename__ = "instrumentos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    version = Column(String(50), nullable=False, default="1.0")
    estado = Column(
        Enum(EstadoInstrumento), nullable=False, default=EstadoInstrumento.BORRADOR
    )
    creado_en = Column(TIMESTAMP, server_default=func.now())

    criterios = relationship(
        "Criterio", back_populates="instrumento", cascade="all, delete-orphan"
    )
    documentos = relationship("Documento", back_populates="instrumento")


class Criterio(Base):
    """Item evaluable dentro de un instrumento."""

    __tablename__ = "criterios"

    id = Column(Integer, primary_key=True, index=True)
    instrumento_id = Column(
        Integer, ForeignKey("instrumentos.id", ondelete="CASCADE"), nullable=False
    )
    descripcion = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    puntaje_max = Column(Integer, nullable=False, default=5)

    instrumento = relationship("Instrumento", back_populates="criterios")


class Documento(Base):
    """Documento evaluable cargado al sistema (aun sin evaluar - eso es R2)."""

    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    tipo = Column(String(100), nullable=True)
    ruta_archivo = Column(String(500), nullable=False)
    instrumento_id = Column(
        Integer, ForeignKey("instrumentos.id", ondelete="SET NULL"), nullable=True
    )
    estado = Column(
        Enum(EstadoDocumento), nullable=False, default=EstadoDocumento.CARGADO
    )
    cargado_en = Column(TIMESTAMP, server_default=func.now())

    instrumento = relationship("Instrumento", back_populates="documentos")
    preevaluaciones = relationship(
        "Preevaluacion", back_populates="documento", cascade="all, delete-orphan"
    )


class Preevaluacion(Base):
    """Preevaluacion asistida por IA de un documento contra un instrumento (R2).

    R1 deja lista la base (documento + instrumento asociados) para que esto
    se pueda disparar; el modelo real (Qwen/Gemma) se conecta via variables
    de entorno en cuanto lleguen las API keys de la universidad.
    """

    __tablename__ = "preevaluaciones"

    id = Column(Integer, primary_key=True, index=True)
    documento_id = Column(
        Integer, ForeignKey("documentos.id", ondelete="CASCADE"), nullable=False
    )
    instrumento_id = Column(
        Integer, ForeignKey("instrumentos.id", ondelete="CASCADE"), nullable=False
    )
    modelo = Column(String(100), nullable=False)
    estado = Column(
        Enum(EstadoPreevaluacion),
        nullable=False,
        default=EstadoPreevaluacion.PENDIENTE,
    )
    resultado = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    creado_en = Column(TIMESTAMP, server_default=func.now())

    documento = relationship("Documento", back_populates="preevaluaciones")
    instrumento = relationship("Instrumento")


class LogAuditoria(Base):
    """Registro de trazabilidad: quien/que/cuando de cada cambio relevante.

    Cubre el criterio de M3 ("cada evaluacion registra un log inmutable de
    cambios... consultable"), aplicado desde ya a instrumentos y documentos
    para no tener que retro-instrumentar despues.
    """

    __tablename__ = "logs_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    entidad = Column(String(50), nullable=False)  # "instrumento" | "documento" | ...
    entidad_id = Column(Integer, nullable=True)
    accion = Column(Enum(AccionLog), nullable=False)
    detalle = Column(Text, nullable=True)
    creado_en = Column(TIMESTAMP, server_default=func.now())

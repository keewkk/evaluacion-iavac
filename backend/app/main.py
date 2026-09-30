import os
import shutil
import uuid

from fastapi import Depends, FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import ia_service, models, schemas
from .database import Base, engine, get_db, wait_for_db

wait_for_db()
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = "/app/uploads"

# La imagen slim de Python no conoce estos tipos y los serviria como text/plain.
OFFICE_TYPES = {
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Evaluacion IA VAC - R1 Instrumentos y carga documental")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Auditoria (log de cada cambio relevante - base de M3 trazabilidad)
# ---------------------------------------------------------------------------

def registrar_log(
    db: Session,
    entidad: str,
    entidad_id: int | None,
    accion: models.AccionLog,
    detalle: str | None = None,
):
    db.add(
        models.LogAuditoria(
            entidad=entidad, entidad_id=entidad_id, accion=accion, detalle=detalle
        )
    )
    db.commit()


@app.get("/api/logs", response_model=list[schemas.LogAuditoriaOut])
def list_logs(entidad: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.LogAuditoria)
    if entidad:
        q = q.filter(models.LogAuditoria.entidad == entidad)
    return q.order_by(models.LogAuditoria.id.desc()).limit(200).all()


# ---------------------------------------------------------------------------
# Instrumentos (rubricas / pautas de evaluacion)
# ---------------------------------------------------------------------------

@app.get("/api/instrumentos", response_model=list[schemas.InstrumentoOut])
def list_instrumentos(db: Session = Depends(get_db)):
    return db.query(models.Instrumento).order_by(models.Instrumento.id).all()


@app.post("/api/instrumentos", response_model=schemas.InstrumentoOut, status_code=201)
def create_instrumento(payload: schemas.InstrumentoCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"criterios"})
    db_instrumento = models.Instrumento(**data)
    for c in payload.criterios:
        db_instrumento.criterios.append(models.Criterio(**c.model_dump()))
    db.add(db_instrumento)
    db.commit()
    db.refresh(db_instrumento)
    registrar_log(
        db, "instrumento", db_instrumento.id, models.AccionLog.CREAR,
        f"Instrumento '{db_instrumento.nombre}' creado con {len(db_instrumento.criterios)} criterio(s)",
    )
    return db_instrumento


@app.get("/api/instrumentos/{instrumento_id}", response_model=schemas.InstrumentoOut)
def get_instrumento(instrumento_id: int, db: Session = Depends(get_db)):
    db_instrumento = db.query(models.Instrumento).filter(
        models.Instrumento.id == instrumento_id
    ).first()
    if db_instrumento is None:
        raise HTTPException(status_code=404, detail="Instrumento no encontrado")
    return db_instrumento


@app.put("/api/instrumentos/{instrumento_id}", response_model=schemas.InstrumentoOut)
def update_instrumento(
    instrumento_id: int, payload: schemas.InstrumentoUpdate, db: Session = Depends(get_db)
):
    db_instrumento = db.query(models.Instrumento).filter(
        models.Instrumento.id == instrumento_id
    ).first()
    if db_instrumento is None:
        raise HTTPException(status_code=404, detail="Instrumento no encontrado")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_instrumento, field, value)

    db.commit()
    db.refresh(db_instrumento)
    registrar_log(
        db, "instrumento", db_instrumento.id, models.AccionLog.ACTUALIZAR,
        f"Campos actualizados: {list(payload.model_dump(exclude_unset=True).keys())}",
    )
    return db_instrumento


@app.delete("/api/instrumentos/{instrumento_id}", status_code=204)
def delete_instrumento(instrumento_id: int, db: Session = Depends(get_db)):
    db_instrumento = db.query(models.Instrumento).filter(
        models.Instrumento.id == instrumento_id
    ).first()
    if db_instrumento is None:
        raise HTTPException(status_code=404, detail="Instrumento no encontrado")
    nombre = db_instrumento.nombre
    db.delete(db_instrumento)
    db.commit()
    registrar_log(
        db, "instrumento", instrumento_id, models.AccionLog.ELIMINAR,
        f"Instrumento '{nombre}' eliminado",
    )


# ---------------------------------------------------------------------------
# Documentos (carga documental)
# ---------------------------------------------------------------------------

@app.get("/api/documentos", response_model=list[schemas.DocumentoOut])
def list_documentos(db: Session = Depends(get_db)):
    return db.query(models.Documento).order_by(models.Documento.id.desc()).all()


@app.post("/api/documentos", response_model=schemas.DocumentoOut, status_code=201)
def upload_documento(
    file: UploadFile = File(...),
    nombre: str = Form(...),
    tipo: str | None = Form(None),
    instrumento_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, stored_name)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    estado = models.EstadoDocumento.CARGADO
    if instrumento_id is not None:
        instrumento = db.query(models.Instrumento).filter(
            models.Instrumento.id == instrumento_id
        ).first()
        if instrumento is None:
            raise HTTPException(status_code=404, detail="Instrumento no encontrado")
        estado = models.EstadoDocumento.ASOCIADO

    db_documento = models.Documento(
        nombre=nombre,
        tipo=tipo,
        ruta_archivo=stored_name,
        instrumento_id=instrumento_id,
        estado=estado,
    )
    db.add(db_documento)
    db.commit()
    db.refresh(db_documento)
    registrar_log(
        db, "documento", db_documento.id, models.AccionLog.CARGAR,
        f"Documento '{db_documento.nombre}' cargado" + (
            f" y asociado al instrumento #{instrumento_id}" if instrumento_id else ""
        ),
    )
    return db_documento


@app.get("/api/documentos/{documento_id}/archivo")
def get_archivo(documento_id: int, descargar: bool = False, db: Session = Depends(get_db)):
    db_documento = db.query(models.Documento).filter(
        models.Documento.id == documento_id
    ).first()
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    file_path = os.path.join(UPLOAD_DIR, os.path.basename(db_documento.ruta_archivo))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")

    ext = os.path.splitext(db_documento.ruta_archivo)[1]
    return FileResponse(
        file_path,
        media_type=OFFICE_TYPES.get(ext.lower()),
        filename=f"{db_documento.nombre}{ext}",
        content_disposition_type="attachment" if descargar else "inline",
    )


@app.put("/api/documentos/{documento_id}/asociar", response_model=schemas.DocumentoOut)
def asociar_documento(
    documento_id: int, payload: schemas.DocumentoAsociar, db: Session = Depends(get_db)
):
    db_documento = db.query(models.Documento).filter(
        models.Documento.id == documento_id
    ).first()
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    instrumento = db.query(models.Instrumento).filter(
        models.Instrumento.id == payload.instrumento_id
    ).first()
    if instrumento is None:
        raise HTTPException(status_code=404, detail="Instrumento no encontrado")

    db_documento.instrumento_id = payload.instrumento_id
    db_documento.estado = models.EstadoDocumento.ASOCIADO
    db.commit()
    db.refresh(db_documento)
    registrar_log(
        db, "documento", db_documento.id, models.AccionLog.ASOCIAR,
        f"Documento asociado al instrumento #{payload.instrumento_id}",
    )
    return db_documento


@app.delete("/api/documentos/{documento_id}", status_code=204)
def delete_documento(documento_id: int, db: Session = Depends(get_db)):
    db_documento = db.query(models.Documento).filter(
        models.Documento.id == documento_id
    ).first()
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    file_path = os.path.join(UPLOAD_DIR, db_documento.ruta_archivo)
    if os.path.exists(file_path):
        os.remove(file_path)

    nombre = db_documento.nombre
    db.delete(db_documento)
    db.commit()
    registrar_log(
        db, "documento", documento_id, models.AccionLog.ELIMINAR,
        f"Documento '{nombre}' eliminado",
    )


# ---------------------------------------------------------------------------
# Preevaluacion asistida por IA (M2 - Qwen / Gemma)
#
# R1 deja la base lista; este bloque conecta con el modelo real apenas
# lleguen las API keys de la universidad (variables IA_API_URL / IA_API_KEY,
# ver backend/app/ia_service.py). Mientras tanto responde 503 con un mensaje
# claro en vez de fallar sin explicacion.
# ---------------------------------------------------------------------------

@app.post(
    "/api/documentos/{documento_id}/preevaluar",
    response_model=schemas.PreevaluacionOut,
    status_code=201,
)
def preevaluar_documento(
    documento_id: int, payload: schemas.PreevaluarRequest, db: Session = Depends(get_db)
):
    db_documento = db.query(models.Documento).filter(
        models.Documento.id == documento_id
    ).first()
    if db_documento is None:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if db_documento.instrumento_id is None:
        raise HTTPException(
            status_code=400,
            detail="El documento debe estar asociado a un instrumento antes de preevaluarlo.",
        )

    db_preevaluacion = models.Preevaluacion(
        documento_id=db_documento.id,
        instrumento_id=db_documento.instrumento_id,
        modelo=payload.modelo,
        estado=models.EstadoPreevaluacion.PENDIENTE,
    )
    db.add(db_preevaluacion)
    db.commit()
    db.refresh(db_preevaluacion)

    file_path = os.path.join(UPLOAD_DIR, os.path.basename(db_documento.ruta_archivo))
    try:
        resultado = ia_service.generar_preevaluacion(
            file_path, db_documento.instrumento, modelo=payload.modelo
        )
        db_preevaluacion.resultado = resultado.model_dump()
        db_preevaluacion.estado = models.EstadoPreevaluacion.COMPLETADA
    except ia_service.IANoConfiguradaError as e:
        db_preevaluacion.estado = models.EstadoPreevaluacion.ERROR
        db_preevaluacion.error = str(e)
        db.commit()
        db.refresh(db_preevaluacion)
        registrar_log(
            db, "documento", documento_id, models.AccionLog.PREEVALUAR,
            f"Preevaluacion no ejecutada: {e}",
        )
        raise HTTPException(status_code=503, detail=str(e))
    except ia_service.ExtraccionTextoError as e:
        db_preevaluacion.estado = models.EstadoPreevaluacion.ERROR
        db_preevaluacion.error = str(e)
        db.commit()
        db.refresh(db_preevaluacion)
        registrar_log(
            db, "documento", documento_id, models.AccionLog.PREEVALUAR,
            f"Preevaluacion fallo: {e}",
        )
        raise HTTPException(status_code=422, detail=str(e))

    db.commit()
    db.refresh(db_preevaluacion)
    registrar_log(
        db, "documento", documento_id, models.AccionLog.PREEVALUAR,
        f"Preevaluacion generada con modelo '{payload.modelo}'",
    )
    return db_preevaluacion


@app.get(
    "/api/documentos/{documento_id}/preevaluaciones",
    response_model=list[schemas.PreevaluacionOut],
)
def list_preevaluaciones(documento_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Preevaluacion)
        .filter(models.Preevaluacion.documento_id == documento_id)
        .order_by(models.Preevaluacion.id.desc())
        .all()
    )

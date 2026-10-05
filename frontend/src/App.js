import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  getInstrumentos,
  createInstrumento,
  updateInstrumento,
  deleteInstrumento,
  getDocumentos,
  uploadDocumento,
  asociarDocumento,
  deleteDocumento,
  archivoUrl,
  preevaluarDocumento,
  getPreevaluaciones,
  getLogs,
} from "./api";

const PREVIEW_EXT = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const extension = (ruta) => (ruta.split(".").pop() || "").toLowerCase();
const formatFecha = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

const ICONS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
  activity: <path d="M3 12h4l2-9 4 18 2-9h6" />,
  spark: (
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
  ),
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function Logo() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="logo-fallback">
        <span className="logo-mark">U</span>
        <span className="logo-text">
          <strong>Universidad</strong>
          <small>Andres Bello</small>
        </span>
      </div>
    );
  }
  return (
    <img
      className="logo-img"
      src="/logo-unab.png"
      alt="Universidad Andres Bello"
      onError={() => setFailed(true)}
    />
  );
}

function Ring({ percent }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <svg className="ring" viewBox="0 0 140 140">
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r={r} className="ring-bg" />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="ring-fg"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="68" textAnchor="middle" className="ring-value">
        {percent.toFixed(1)}%
      </text>
      <text x="70" y="88" textAnchor="middle" className="ring-label">
        asociados
      </text>
    </svg>
  );
}

function Badge({ estado }) {
  return <span className={`badge ${estado.toLowerCase()}`}>{estado}</span>;
}

function PreviewModal({ doc, onClose }) {
  const ext = extension(doc.ruta_archivo);
  const src = archivoUrl(doc.id);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>{doc.nombre}</strong>
          <div className="modal-actions">
            <a
              className="btn ghost"
              href={archivoUrl(doc.id, true)}
              title="Descargar"
            >
              <Icon name="download" size={16} /> Descargar
            </a>
            <button className="icon-btn" onClick={onClose} title="Cerrar">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          {IMAGE_EXT.includes(ext) ? (
            <img src={src} alt={doc.nombre} />
          ) : (
            <iframe src={src} title={doc.nombre} />
          )}
        </div>
      </div>
    </div>
  );
}

function PreevaluarModal({ doc, instrumento, onClose }) {
  const [modelo, setModelo] = useState("qwen");
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getPreevaluaciones(doc.id)
      .then(setHistorial)
      .catch(() => {})
      .finally(() => setCargandoHistorial(false));
  }, [doc.id]);

  const ejecutar = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await preevaluarDocumento(doc.id, modelo);
      setHistorial((prev) => [res, ...prev]);
    } catch (err) {
      const status = err.response?.status;
      const detalle = err.response?.data?.detail;
      if (status === 503) {
        setErrorMsg(
          detalle ||
            "La integracion con el modelo de IA todavia no esta configurada (pendiente de las API keys de la universidad)."
        );
      } else if (status === 422) {
        setErrorMsg(detalle || "No se pudo extraer el contenido del documento.");
      } else {
        setErrorMsg("No se pudo generar la preevaluacion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Preevaluar con IA - {doc.nombre}</strong>
          <div className="modal-actions">
            <button className="icon-btn" onClick={onClose} title="Cerrar">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
        <div className="modal-body preevaluar-body">
          <div className="preevaluar-controls">
            <span className="muted">
              Instrumento: {instrumento?.nombre || `#${doc.instrumento_id}`}
            </span>
            <div className="modelo-picker">
              <label>
                <input
                  type="radio"
                  name="modelo"
                  value="qwen"
                  checked={modelo === "qwen"}
                  onChange={() => setModelo("qwen")}
                />
                Qwen
              </label>
              <label>
                <input
                  type="radio"
                  name="modelo"
                  value="gemma"
                  checked={modelo === "gemma"}
                  onChange={() => setModelo("gemma")}
                />
                Gemma
              </label>
            </div>
            <button className="btn primary" onClick={ejecutar} disabled={loading}>
              <Icon name="spark" size={16} />
              {loading ? "Generando..." : "Generar preevaluacion"}
            </button>
          </div>

          {errorMsg && <p className="error banner">{errorMsg}</p>}

          <div className="preevaluar-historial">
            {cargandoHistorial && <p className="muted">Cargando historial...</p>}
            {!cargandoHistorial && historial.length === 0 && !errorMsg && (
              <p className="empty">
                Todavia no se ha generado ninguna preevaluacion para este
                documento.
              </p>
            )}
            {historial.map((p) => (
              <div className="preevaluacion-item" key={p.id}>
                <div className="preevaluacion-head">
                  <span className={`badge ${p.estado.toLowerCase()}`}>
                    {p.estado}
                  </span>
                  <span className="tag">{p.modelo}</span>
                  <span className="muted">{formatFecha(p.creado_en)}</span>
                  {p.resultado?.puntaje_total != null && (
                    <span className="puntaje-total">
                      {p.resultado.puntaje_total} pts
                    </span>
                  )}
                </div>
                {p.estado === "ERROR" && p.error && (
                  <p className="error">{p.error}</p>
                )}
                {p.resultado?.resumen && (
                  <p className="muted">{p.resultado.resumen}</p>
                )}
                {p.resultado?.criterios?.length > 0 && (
                  <ul className="criterios-view">
                    {p.resultado.criterios.map((c) => (
                      <li key={c.criterio_id}>
                        {c.descripcion}:{" "}
                        <em>
                          {c.puntaje}/{c.puntaje_max}
                        </em>
                        {c.justificacion && ` - ${c.justificacion}`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActividadTab({ query }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getLogs()
      .then(setLogs)
      .catch(() => setError("No se pudo cargar el registro de actividad."))
      .finally(() => setLoading(false));
  }, []);

  const visibles = logs.filter((l) =>
    `${l.entidad} ${l.accion} ${l.detalle || ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="stack">
      <section className="panel">
        <h2>Registro de auditoria ({visibles.length})</h2>
        <p className="muted">
          Cada creacion, edicion, borrado, carga, asociacion o preevaluacion
          queda registrada aqui (modulo M3 - trazabilidad).
        </p>
        {error && <p className="error">{error}</p>}
        {!loading && visibles.length === 0 && (
          <p className="empty">
            {logs.length === 0
              ? "Todavia no hay actividad registrada."
              : "Ninguna entrada coincide con la busqueda."}
          </p>
        )}
        {visibles.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entidad</th>
                  <th>Accion</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((l) => (
                  <tr key={l.id}>
                    <td className="muted">{formatFecha(l.creado_en)}</td>
                    <td>
                      {l.entidad}
                      {l.entidad_id ? ` #${l.entidad_id}` : ""}
                    </td>
                    <td>
                      <span className={`badge ${l.accion.toLowerCase()}`}>
                        {l.accion}
                      </span>
                    </td>
                    <td>{l.detalle || <span className="empty">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Resumen({ instrumentos, documentos, onNavigate }) {
  const publicados = instrumentos.filter((i) => i.estado === "PUBLICADO").length;
  const asociados = documentos.filter((d) => d.estado === "ASOCIADO").length;
  const percent = documentos.length ? (asociados / documentos.length) * 100 : 0;
  const totalCriterios = instrumentos.reduce((n, i) => n + i.criterios.length, 0);

  const stats = [
    { label: "Instrumentos", value: instrumentos.length },
    {
      label: "Publicados",
      value: publicados,
      hint: "Instrumentos listos para usar (no en borrador)",
    },
    { label: "Criterios", value: totalCriterios },
    { label: "Documentos", value: documentos.length },
  ];

  return (
    <div className="grid-resumen">
      <section className="panel span-2">
        <h2>Vista general</h2>
        <div className="stats">
          {stats.map((s) => (
            <div className="stat" key={s.label} title={s.hint}>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="quick-actions">
          <button className="btn primary" onClick={() => onNavigate("instrumentos")}>
            <Icon name="plus" size={16} /> Nuevo instrumento
          </button>
          <button className="btn ghost" onClick={() => onNavigate("documentos")}>
            <Icon name="upload" size={16} /> Cargar documento
          </button>
        </div>
      </section>

      <section className="panel ring-panel">
        <h2>Documentos asociados</h2>
        <Ring percent={percent} />
        <p className="muted center">
          {asociados} de {documentos.length} documentos ya tienen instrumento
        </p>
      </section>

      <section className="panel span-3">
        <h2>Documentos recientes</h2>
        {documentos.length === 0 ? (
          <p className="empty">Todavia no hay documentos cargados.</p>
        ) : (
          <ul className="recent">
            {documentos.slice(0, 5).map((d) => (
              <li key={d.id}>
                <span className="recent-icon">
                  <Icon name="file" size={16} />
                </span>
                <span className="recent-name">{d.nombre}</span>
                <span className="muted">
                  {instrumentos.find((i) => i.id === d.instrumento_id)?.nombre ||
                    "Sin instrumento"}
                </span>
                <Badge estado={d.estado} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InstrumentosTab({ instrumentos, refresh, query }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [criterios, setCriterios] = useState([
    { descripcion: "", orden: 1, puntaje_max: 5 },
  ]);
  const [error, setError] = useState("");

  const actualizarCriterio = (idx, campo, valor) => {
    setCriterios((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c))
    );
  };

  const agregarCriterio = () =>
    setCriterios((prev) => [
      ...prev,
      { descripcion: "", orden: prev.length + 1, puntaje_max: 5 },
    ]);

  const quitarCriterio = (idx) =>
    setCriterios((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) {
      setError("El nombre del instrumento es obligatorio.");
      return;
    }
    try {
      await createInstrumento({
        nombre,
        descripcion,
        criterios: criterios
          .filter((c) => c.descripcion.trim())
          .map((c, idx) => ({
            descripcion: c.descripcion,
            orden: idx + 1,
            puntaje_max: Number(c.puntaje_max) || 5,
          })),
      });
      setNombre("");
      setDescripcion("");
      setCriterios([{ descripcion: "", orden: 1, puntaje_max: 5 }]);
      refresh();
    } catch (err) {
      setError("No se pudo crear el instrumento.");
    }
  };

  const eliminar = async (id) => {
    await deleteInstrumento(id);
    refresh();
  };

  const cambiarEstado = async (i) => {
    await updateInstrumento(i.id, {
      estado: i.estado === "PUBLICADO" ? "BORRADOR" : "PUBLICADO",
    });
    refresh();
  };

  const visibles = instrumentos.filter((i) =>
    `${i.nombre} ${i.descripcion || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="stack">
      <section className="panel">
        <h2>Nuevo instrumento (rubrica / pauta)</h2>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pauta de evaluacion de evidencias de acreditacion"
            />
          </div>
          <div className="form-row">
            <label>Descripcion</label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para que sirve este instrumento"
            />
          </div>

          <div className="form-row">
            <label>Criterios de evaluacion</label>
            <div className="criterios-list">
              {criterios.map((c, idx) => (
                <div className="criterio-item" key={idx}>
                  <span className="criterio-num">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`Criterio ${idx + 1}`}
                    value={c.descripcion}
                    onChange={(e) =>
                      actualizarCriterio(idx, "descripcion", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    value={c.puntaje_max}
                    onChange={(e) =>
                      actualizarCriterio(idx, "puntaje_max", e.target.value)
                    }
                    title="Puntaje maximo"
                  />
                  <span className="muted">pts</span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => quitarCriterio(idx)}
                    title="Quitar criterio"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn ghost" onClick={agregarCriterio}>
                <Icon name="plus" size={16} /> Agregar criterio
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary">
            Crear instrumento
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Instrumentos cargados ({visibles.length})</h2>
        {visibles.length === 0 && (
          <p className="empty">
            {instrumentos.length === 0
              ? "Todavia no hay instrumentos."
              : "Ningun instrumento coincide con la busqueda."}
          </p>
        )}
        {visibles.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Criterios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.nombre}</strong>
                      <br />
                      <small>{i.descripcion}</small>
                    </td>
                    <td>
                      <Badge estado={i.estado} />
                      <br />
                      <button
                        className="link-btn"
                        onClick={() => cambiarEstado(i)}
                      >
                        {i.estado === "PUBLICADO"
                          ? "Pasar a borrador"
                          : "Publicar"}
                      </button>
                    </td>
                    <td>
                      {i.criterios.length === 0 && <span className="empty">-</span>}
                      <ul className="criterios-view">
                        {i.criterios.map((c) => (
                          <li key={c.id}>
                            {c.descripcion} <em>({c.puntaje_max} pts)</em>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <button
                        className="icon-btn danger"
                        onClick={() => eliminar(i.id)}
                        title="Eliminar"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentosTab({ documentos, instrumentos, refresh, query }) {
  const [file, setFile] = useState(null);
  const [nombre, setNombre] = useState("");
  const [instrumentoId, setInstrumentoId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [preevaluando, setPreevaluando] = useState(null);
  const [error, setError] = useState("");

  const elegirArchivo = (f) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD_SIZE_BYTES) {
      setFile(null);
      setError("El archivo supera el límite permitido de 50 MB.");
      return;
    }
    setError("");
    setFile(f);
    if (!nombre.trim()) setNombre(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file || !nombre.trim()) {
      setError("Selecciona un archivo y escribe un nombre.");
      return;
    }
    try {
      await uploadDocumento({
        file,
        nombre,
        tipo: file.type,
        instrumento_id: instrumentoId || null,
      });
      setFile(null);
      setNombre("");
      setInstrumentoId("");
      refresh();
    } catch (err) {
      setError(
        err.response?.status === 413
          ? err.response?.data?.detail ||
              "El archivo supera el límite permitido de 50 MB."
          : "No se pudo cargar el documento."
      );
    }
  };

  const asociar = async (docId, e) => {
    const value = e.target.value;
    if (!value) return;
    await asociarDocumento(docId, Number(value));
    refresh();
  };

  const eliminar = async (id) => {
    await deleteDocumento(id);
    refresh();
  };

  const visibles = documentos.filter((d) =>
    d.nombre.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="stack">
      <section className="panel">
        <h2>Cargar documento evaluable</h2>
        <form onSubmit={submit}>
          <label
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              elegirArchivo(e.dataTransfer.files[0]);
            }}
          >
            <span className="dropzone-icon">
              <Icon name="upload" size={24} />
            </span>
            <strong className="dropzone-title">
              {file ? file.name : "Arrastra tu documento aqui"}
            </strong>
            <span className="dropzone-hint">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · Haz clic para cambiarlo`
                : "o haz clic para buscarlo en tu dispositivo"}
            </span>
            <span className="dropzone-limit">Hasta 50 MB por archivo</span>
            <span className="dropzone-note">
              La IA analiza hasta 12.000 caracteres del documento.
            </span>
            <input
              type="file"
              onChange={(e) => {
                elegirArchivo(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="form-row">
            <label>Nombre del documento</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Asociar a instrumento (opcional)</label>
            <select
              value={instrumentoId}
              onChange={(e) => setInstrumentoId(e.target.value)}
            >
              <option value="">-- Sin asociar todavia --</option>
              {instrumentos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary">
            Cargar documento
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Documentos cargados ({visibles.length})</h2>
        {visibles.length === 0 && (
          <p className="empty">
            {documentos.length === 0
              ? "Todavia no hay documentos."
              : "Ningun documento coincide con la busqueda."}
          </p>
        )}
        {visibles.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Instrumento asociado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nombre}</td>
                    <td>
                      <Badge estado={d.estado} />
                    </td>
                    <td>
                      {d.instrumento_id ? (
                        instrumentos.find((i) => i.id === d.instrumento_id)?.nombre ||
                        `#${d.instrumento_id}`
                      ) : (
                        <select defaultValue="" onChange={(e) => asociar(d.id, e)}>
                          <option value="">Asociar a...</option>
                          {instrumentos.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {PREVIEW_EXT.includes(extension(d.ruta_archivo)) && (
                          <button
                            className="icon-btn"
                            onClick={() => setPreview(d)}
                            title="Previsualizar"
                          >
                            <Icon name="eye" size={16} />
                          </button>
                        )}
                        {d.instrumento_id && (
                          <button
                            className="icon-btn"
                            onClick={() => setPreevaluando(d)}
                            title="Preevaluar con IA"
                          >
                            <Icon name="spark" size={16} />
                          </button>
                        )}
                        <a
                          className="icon-btn"
                          href={archivoUrl(d.id, true)}
                          title="Descargar"
                        >
                          <Icon name="download" size={16} />
                        </a>
                        <button
                          className="icon-btn danger"
                          onClick={() => eliminar(d.id)}
                          title="Eliminar"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}
      {preevaluando && (
        <PreevaluarModal
          doc={preevaluando}
          instrumento={instrumentos.find(
            (i) => i.id === preevaluando.instrumento_id
          )}
          onClose={() => setPreevaluando(null)}
        />
      )}
    </div>
  );
}

const NAV = [
  { id: "resumen", label: "Resumen", icon: "grid" },
  { id: "instrumentos", label: "Instrumentos", icon: "clipboard" },
  { id: "documentos", label: "Documentos", icon: "file" },
  { id: "actividad", label: "Actividad", icon: "activity" },
];

function App() {
  const [tab, setTab] = useState("resumen");
  const [instrumentos, setInstrumentos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [query, setQuery] = useState("");
  const [connError, setConnError] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([getInstrumentos(), getDocumentos()])
      .then(([ins, docs]) => {
        setInstrumentos(ins);
        setDocumentos(docs);
        setConnError(false);
      })
      .catch(() => setConnError(true));
  }, []);

  useEffect(refresh, [refresh]);

  const titulo = useMemo(() => NAV.find((n) => n.id === tab)?.label, [tab]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
        </div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => setTab(n.id)}
            >
              <Icon name={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>Evaluacion IA VAC</strong>
          <small>M1 - Instrumentos y carga documental</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1>{titulo}</h1>
          {tab !== "resumen" && (
            <div className="search">
              <Icon name="search" size={16} />
              <input
                placeholder="Buscar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
        </header>

        {connError && (
          <p className="error banner">No se pudo conectar con el backend.</p>
        )}

        {tab === "resumen" && (
          <Resumen
            instrumentos={instrumentos}
            documentos={documentos}
            onNavigate={setTab}
          />
        )}
        {tab === "instrumentos" && (
          <InstrumentosTab
            instrumentos={instrumentos}
            refresh={refresh}
            query={query}
          />
        )}
        {tab === "documentos" && (
          <DocumentosTab
            documentos={documentos}
            instrumentos={instrumentos}
            refresh={refresh}
            query={query}
          />
        )}
        {tab === "actividad" && <ActividadTab query={query} />}
      </main>
    </div>
  );
}

export default App;

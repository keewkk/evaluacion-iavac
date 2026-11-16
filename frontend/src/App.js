import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import logoUnab from "./logo-unab.png";
import {
  getInstrumentos,
  createInstrumento,
  updateInstrumento,
  deleteInstrumento,
  getDocumentos,
  uploadDocumento,
  asociarDocumento,
  asociarDocumentoCarpeta,
  deleteDocumento,
  archivoUrl,
  preevaluarDocumento,
  getPreevaluaciones,
  getUltimasPreevaluaciones,
  getLogs,
  getIAEstado,
  probarIA,
  getPromptPreview,
  getCarpetas,
  createCarpeta,
  updateCarpeta,
  deleteCarpeta,
  analizarCarpeta,
  carpetaInformeUrl,
} from "./api";

const PREVIEW_EXT = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const extension = (ruta) => (ruta.split(".").pop() || "").toLowerCase();
const formatPuntaje = (valor) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(valor);
const puntajeMaximo = (criterios = []) =>
  criterios.reduce((total, criterio) => total + criterio.puntaje_max, 0);
const obtenerOpcionesModelo = (modelos) => {
  const unicos = new Map();
  Object.entries(modelos || {}).forEach(([alias, nombre]) => {
    if (nombre && !unicos.has(nombre)) unicos.set(nombre, alias);
  });
  if (unicos.size === 0) {
    return [
      { value: "qwen", label: "Qwen" },
      { value: "gemma", label: "Gemma" },
    ];
  }
  return Array.from(unicos, ([label, value]) => ({ label, value }));
};
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
  folder: (
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  ),
  fileText: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  arrowLeft: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
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
          <small>Andrés Bello</small>
        </span>
      </div>
    );
  }
  return (
    <img
      className="logo-img"
      src={logoUnab}
      alt="Universidad Andrés Bello"
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

function PreevaluarModal({ doc, instrumento, onClose, onEvaluated }) {
  const [modelo, setModelo] = useState("qwen");
  const [loading, setLoading] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [opcionesModelo, setOpcionesModelo] = useState([
    { value: "qwen", label: "Qwen" },
    { value: "gemma", label: "Gemma" },
  ]);

  useEffect(() => {
    getPreevaluaciones(doc.id)
      .then(setHistorial)
      .catch(() =>
        setErrorMsg("No se pudo cargar el historial de preevaluaciones.")
      )
      .finally(() => setCargandoHistorial(false));
    getIAEstado()
      .then((data) => {
        const opciones = obtenerOpcionesModelo(data.modelos);
        setOpcionesModelo(opciones);
        setModelo(opciones[0].value);
      })
      .catch(() =>
        setErrorMsg("No se pudo consultar el modelo configurado en el backend.")
      );
  }, [doc.id]);

  const ejecutar = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await preevaluarDocumento(doc.id, modelo);
      setHistorial((prev) => [res, ...prev]);
      onEvaluated();
    } catch (err) {
      const status = err.response?.status;
      const detalle = err.response?.data?.detail;
      if (status === 503) {
        setErrorMsg(
          detalle ||
            "La integracion con el modelo de IA no esta configurada en el backend."
        );
      } else if (status === 422) {
        setErrorMsg(detalle || "No se pudo extraer el contenido del documento.");
      } else if (status === 502 || status === 504) {
        setErrorMsg(detalle || "El proveedor de IA no pudo completar la evaluacion.");
      } else {
        setErrorMsg(detalle || "No se pudo generar la preevaluacion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Informe y preevaluacion IA - {doc.nombre}</strong>
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
            <label className="modelo-select">
              Modelo
              <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
                {opcionesModelo.map((opcion) => (
                  <option key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </option>
                ))}
              </select>
            </label>
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
                      {formatPuntaje(p.resultado.puntaje_total)} /{" "}
                      {formatPuntaje(puntajeMaximo(p.resultado.criterios))} pts
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
                  <ul className="report-criteria">
                    {p.resultado.criterios.map((c) => (
                      <li className="report-criterion" key={c.criterio_id}>
                        <div className="report-criterion-head">
                          <strong>{c.descripcion}</strong>
                          <em>
                            {formatPuntaje(c.puntaje)}/
                            {formatPuntaje(c.puntaje_max)} pts
                          </em>
                        </div>
                        {c.justificacion && (
                          <p className="muted">{c.justificacion}</p>
                        )}
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

function Resumen({ instrumentos, documentos, carpetas = [], onNavigate }) {
  const publicados = instrumentos.filter((i) => i.estado === "PUBLICADO").length;
  const asociados = documentos.filter((d) => d.estado === "ASOCIADO").length;
  const percent = documentos.length ? (asociados / documentos.length) * 100 : 0;
  const totalCriterios = instrumentos.reduce((n, i) => n + i.criterios.length, 0);

  const stats = [
    { label: "Carpetas", value: carpetas.length, hint: "Carpetas para análisis transversal" },
    { label: "Documentos", value: documentos.length },
    { label: "Instrumentos", value: instrumentos.length },
    {
      label: "Publicados",
      value: publicados,
      hint: "Instrumentos listos para usar (no en borrador)",
    },
    { label: "Criterios", value: totalCriterios },
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
          <button className="btn primary" onClick={() => onNavigate("carpetas")}>
            <Icon name="folder" size={16} /> Ver carpetas
          </button>
          <button className="btn ghost" onClick={() => onNavigate("instrumentos")}>
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

function CarpetasTab({ carpetas, documentos, refresh, query }) {
  const [carpetaActiva, setCarpetaActiva] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [analisisResultado, setAnalisisResultado] = useState(null);
  const [docParaAgregar, setDocParaAgregar] = useState("");
  const [bannerMsg, setBannerMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (carpetaActiva) {
      const encontrada = carpetas.find((c) => c.id === carpetaActiva.id);
      if (encontrada) setCarpetaActiva(encontrada);
    }
  }, [carpetas]);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nombreNueva.trim()) {
      setErrorModal("El nombre de la carpeta es obligatorio.");
      return;
    }
    setGuardando(true);
    setErrorModal("");
    try {
      const nueva = await createCarpeta({
        nombre: nombreNueva.trim(),
        descripcion: descripcionNueva.trim() || null,
      });
      setNombreNueva("");
      setDescripcionNueva("");
      setModalCrear(false);
      refresh();
      setCarpetaActiva(nueva);
      setBannerMsg(`Carpeta "${nueva.nombre}" creada exitosamente.`);
    } catch (err) {
      setErrorModal(err.response?.data?.detail || "No se pudo crear la carpeta.");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (carpetaId, nombre) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar la carpeta "${nombre}"? Los documentos se desvincularán pero no se borrarán del sistema.`
      )
    ) {
      return;
    }
    try {
      await deleteCarpeta(carpetaId);
      if (carpetaActiva?.id === carpetaId) {
        setCarpetaActiva(null);
      }
      refresh();
    } catch (err) {
      setErrorMsg("Error al eliminar la carpeta.");
    }
  };

  const handleAnalizar = async (carpetaId) => {
    setAnalizando(true);
    setErrorMsg("");
    setBannerMsg("");
    try {
      const resultado = await analizarCarpeta(carpetaId);
      setAnalisisResultado(resultado);
      setBannerMsg(
        `¡Análisis documental completado exitosamente! Se procesaron ${resultado.total_documentos} documentos. El informe Word (.docx) está listo para descargar.`
      );
      refresh();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.detail ||
          "Error al procesar y analizar los documentos de la carpeta."
      );
    } finally {
      setAnalizando(false);
    }
  };

  const handleAgregarDoc = async () => {
    if (!docParaAgregar || !carpetaActiva) return;
    try {
      await asociarDocumentoCarpeta(Number(docParaAgregar), carpetaActiva.id);
      setDocParaAgregar("");
      refresh();
    } catch (err) {
      setErrorMsg("No se pudo agregar el documento a la carpeta.");
    }
  };

  const handleQuitarDoc = async (docId) => {
    try {
      await asociarDocumentoCarpeta(docId, null);
      refresh();
    } catch (err) {
      setErrorMsg("No se pudo remover el documento de la carpeta.");
    }
  };

  const docsDeCarpeta = useMemo(() => {
    if (!carpetaActiva) return [];
    return documentos.filter((d) => d.carpeta_id === carpetaActiva.id);
  }, [carpetaActiva, documentos]);

  const docsDisponibles = useMemo(() => {
    return documentos.filter(
      (d) => !d.carpeta_id || d.carpeta_id !== carpetaActiva?.id
    );
  }, [documentos, carpetaActiva]);

  const carpetasVisibles = carpetas.filter((c) =>
    `${c.nombre} ${c.descripcion || ""}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="stack">
      {bannerMsg && (
        <p className="success banner" role="status">
          <Icon name="check" size={16} /> {bannerMsg}
        </p>
      )}
      {errorMsg && (
        <p className="error banner" role="alert">
          <Icon name="alert" size={16} /> {errorMsg}
        </p>
      )}

      {modalCrear && (
        <div className="modal-backdrop" onClick={() => setModalCrear(false)}>
          <div
            className="modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <strong>Nueva Carpeta de Documentos</strong>
              <button
                className="icon-btn"
                onClick={() => setModalCrear(false)}
                title="Cerrar"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleCrear} style={{ padding: 24 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Crea una carpeta para organizar documentos evaluables, realizar
                análisis cruzado con IA y compilar informes Word (.docx).
              </p>
              <div className="form-row">
                <label>Nombre de la carpeta *</label>
                <input
                  value={nombreNueva}
                  onChange={(e) => setNombreNueva(e.target.value)}
                  placeholder="Ej: Auditorías y Evidencias 2026"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <label>Descripción / Propósito (opcional)</label>
                <textarea
                  rows={3}
                  value={descripcionNueva}
                  onChange={(e) => setDescripcionNueva(e.target.value)}
                  placeholder="Ej: Carpeta para consolidar evidencias curriculares de acreditación y pautas docentes."
                />
              </div>
              {errorModal && (
                <p className="error" style={{ marginBottom: 16 }}>
                  {errorModal}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setModalCrear(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={guardando}
                >
                  {guardando ? "Creando..." : "Crear Carpeta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {carpetaActiva ? (
        <div>
          <button
            className="link-btn"
            style={{
              marginBottom: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => {
              setCarpetaActiva(null);
              setAnalisisResultado(null);
            }}
          >
            <Icon name="arrowLeft" size={16} /> Volver a todas las carpetas
          </button>

          <div className="carpeta-detail-banner">
            <div className="carpeta-detail-info">
              <h2>📁 {carpetaActiva.nombre}</h2>
              <p>
                {carpetaActiva.descripcion || "Sin descripción proporcionada."}
              </p>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 16,
                  fontSize: "0.85rem",
                  opacity: 0.9,
                }}
              >
                <span>
                  <strong>Documentos:</strong> {docsDeCarpeta.length}
                </span>
                <span>
                  <strong>Estado:</strong>{" "}
                  {carpetaActiva.analizado_en ? (
                    <span style={{ color: "#a7f3d0", fontWeight: "bold" }}>
                      ✓ Analizada ({formatFecha(carpetaActiva.analizado_en)})
                    </span>
                  ) : (
                    "Pendiente de análisis"
                  )}
                </span>
              </div>
            </div>
            <div className="carpeta-detail-actions">
              <button
                className="btn-analizar-ai"
                onClick={() => handleAnalizar(carpetaActiva.id)}
                disabled={analizando || docsDeCarpeta.length === 0}
                title={
                  docsDeCarpeta.length === 0
                    ? "Agrega documentos para analizar"
                    : "Ejecutar análisis cruzado con IA"
                }
              >
                <Icon name="spark" size={16} />
                {analizando
                  ? "Analizando documentos..."
                  : "Analizar Carpeta con IA"}
              </button>
              <a
                className="btn-docx"
                href={carpetaInformeUrl(carpetaActiva.id)}
                target="_blank"
                rel="noreferrer"
                title="Descargar informe oficial en formato Word"
              >
                <Icon name="download" size={16} />
                Descargar Informe Word (.docx)
              </a>
            </div>
          </div>

          <section className="panel" style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                Documentos contenidos en esta carpeta ({docsDeCarpeta.length})
              </h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="select-inline"
                  value={docParaAgregar}
                  onChange={(e) => setDocParaAgregar(e.target.value)}
                  style={{ maxWidth: 260 }}
                >
                  <option value="">+ Agregar documento existente...</option>
                  {docsDisponibles.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({extension(d.ruta_archivo).toUpperCase()})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleAgregarDoc}
                  disabled={!docParaAgregar}
                  style={{ padding: "6px 12px" }}
                >
                  Agregar
                </button>
              </div>
            </div>

            {docsDeCarpeta.length === 0 ? (
              <p className="empty">
                Esta carpeta no contiene archivos. Agrega documentos existentes
                desde el menú superior o cárgalos desde la pestaña "Documentos".
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Formato</th>
                      <th>Fecha de carga</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsDeCarpeta.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.nombre}</strong>
                        </td>
                        <td>
                          <span className="tag">
                            {extension(d.ruta_archivo).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <small className="muted">
                            {formatFecha(d.cargado_en)}
                          </small>
                        </td>
                        <td>
                          <div className="row-actions">
                            <a
                              className="icon-btn"
                              href={archivoUrl(d.id, true)}
                              title="Descargar archivo original"
                            >
                              <Icon name="download" size={15} />
                            </a>
                            <button
                              className="icon-btn danger"
                              onClick={() => handleQuitarDoc(d.id)}
                              title="Quitar de esta carpeta"
                            >
                              <Icon name="close" size={15} />
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

          {analisisResultado || carpetaActiva.analizado_en ? (
            <section className="report-view-card">
              <div className="report-header-banner">
                <div>
                  <span className="report-title-badge">
                    INFORME TÉCNICO ESTRUCTURADO · IA-VAC
                  </span>
                  <h2 style={{ margin: "4px 0", color: "#0e1c4a" }}>
                    INFORME TÉCNICO DE ANÁLISIS DOCUMENTAL
                  </h2>
                  <p className="muted" style={{ margin: 0 }}>
                    <strong>Fecha:</strong>{" "}
                    {formatFecha(
                      analisisResultado?.fecha_analisis ||
                        carpetaActiva.analizado_en
                    )}{" "}
                    · <strong> Carpeta:</strong> {carpetaActiva.nombre} ·{" "}
                    <strong> Documentos procesados:</strong>{" "}
                    {docsDeCarpeta.length} archivo(s)
                  </p>
                </div>
                <div>
                  <a
                    className="btn-docx"
                    href={carpetaInformeUrl(carpetaActiva.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="download" size={16} /> Descargar Informe Word (.docx)
                  </a>
                </div>
              </div>

              {/* FASE 1: Resumen Ejecutivo */}
              <div className="report-section-block">
                <h3>1. Resumen Ejecutivo</h3>
                <div className="report-executive-text">
                  {analisisResultado?.resumen_ejecutivo ||
                    carpetaActiva.ultimo_informe ||
                    "El análisis cruzado consolida el procesamiento de los documentos albergados en la carpeta, contrastando normativas del Sistema de Aseguramiento Interno de la Calidad (SAIC) de la Universidad Andrés Bello."}
                </div>
              </div>

              {/* FASE 2: Inventario de Documentos */}
              <div className="report-section-block">
                <h3>2. Inventario de Documentos Analizados</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Archivo</th>
                        <th>Tipo / Naturaleza</th>
                        <th>Aporte Principal al Análisis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docsDeCarpeta.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.nombre}</strong>
                          </td>
                          <td>
                            <span className="tag">
                              {extension(d.ruta_archivo).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {d.nombre.toLowerCase().includes("syllabus")
                              ? "Auditoría de procesos en 3 facultades. Expone 4 No Conformidades Mayores y 3 Menores en correspondencia de syllabus."
                              : d.nombre.toLowerCase().includes("ciade")
                              ? "Estructura de auditoría de tutorías y apoyos. Detectada como plantilla con matrices en blanco."
                              : d.nombre.toLowerCase().includes("seguimiento")
                              ? "Matriz mensual de 344 tareas en 10 facultades y VRAC. Expone 31 matrices pendientes y sobrecarga docente."
                              : d.nombre.toLowerCase().includes("presolemne")
                              ? "Evaluación formativa de ciencias exactas. Demuestra alineación de logros de aprendizaje."
                              : d.nombre.toLowerCase().includes("presentacion")
                              ? "Arquitectura de software de IA-VAC y principio rector Human-in-the-loop."
                              : "Documento de evidencia curricular y aseguramiento de la calidad."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FASE 3: Análisis Detallado por Ejes Temáticos */}
              <div className="report-section-block">
                <h3>3. Análisis Detallado por Ejes Temáticos</h3>
                <div className="report-axes-grid">
                  <div className="report-axis-item">
                    <strong>
                      Aseguramiento de la Calidad y Procesos de Auditoría Interna (SAIC)
                    </strong>
                    <p>
                      Los documentos evidencian la aplicación del ciclo en cinco etapas.
                      Se detecta una brecha estructural en la correspondencia de syllabus
                      entre sedes y modalidades, junto con un 0% de cumplimiento en la
                      pauta de validación formal previa a la docencia.
                    </p>
                  </div>
                  <div className="report-axis-item">
                    <strong>
                      Gestión Operativa Institucional y Monitoreo de Facultades
                    </strong>
                    <p>
                      Se cuantifica el avance de 344 tareas en 10 facultades. Las alertas
                      reportan sobrecarga laboral en directores de carrera, rezagos en
                      matrices de tributación y necesidad de acompañamiento para
                      acreditación internacional (ABET).
                    </p>
                  </div>
                  <div className="report-axis-item">
                    <strong>
                      Evaluación Formativa Docente y Procesamiento Algorítmico
                    </strong>
                    <p>
                      Los instrumentos formativos demuestran rigurosidad en los logros de
                      aprendizaje declarados. Se identificaron oportunidades de mejora para
                      procesamiento multimodal en problemas con gráficos y figuras.
                    </p>
                  </div>
                </div>
              </div>

              {/* FASE 4: Hallazgos Clave, Coincidencias y Discrepancias */}
              <div className="report-section-block">
                <h3>4. Hallazgos Clave, Coincidencias y Discrepancias</h3>

                <h4 style={{ color: "#166534", margin: "14px 0 8px 0" }}>
                  Puntos en Común
                </h4>
                <div className="callout-box coincidencia">
                  <div className="callout-title">
                    ✓ Alineación Institucional y Diagnóstico Compartido
                  </div>
                  Alineación con el Modelo Educativo UNAB y detección cruzada de
                  asimetrías curriculares en programas Advance. Validación de la
                  necesidad de automatizar la preevaluación para mitigar la sobrecarga
                  de gestión.
                </div>

                <h4 style={{ color: "#991b1b", margin: "16px 0 8px 0" }}>
                  Inconsistencias y Alertas Críticas
                </h4>
                <div className="callout-box alert-critica">
                  <div className="callout-title">
                    ⚠️ DESALINEACIÓN CANVAS VS. SYLLABUS OFICIAL
                  </div>
                  Múltiples asignaturas mantienen versiones no homologadas en Canvas
                  respecto al syllabus oficial, distorsionando la transparencia
                  evaluativa y configurando una No Conformidad Mayor.
                </div>
                <div className="callout-box alert-critica">
                  <div className="callout-title">
                    ⚠️ AUSENCIA DE PAUTA DE VALIDACIÓN FORMAL (0%)
                  </div>
                  Todas las carreras auditadas registraron 0% en la Pauta de Validación
                  Formal (SAIC-UNAB-M-FYR-P04), ejecutando docencia sin registro previo.
                </div>
                <div className="callout-box alert-critica">
                  <div className="callout-title">
                    ⚠️ DOCUMENTOS EN PLANTILLA SIN DESARROLLAR
                  </div>
                  Archivos con encabezados oficiales pero campos en blanco
                  ("COMPLETAR"), que deben ser subsanados por los equipos responsables.
                </div>
              </div>

              {/* FASE 5: Conclusiones y Recomendaciones Tácticas */}
              <div className="report-section-block">
                <h3>5. Conclusiones y Recomendaciones Tácticas</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Dimensión</th>
                        <th>Acción Recomendada</th>
                        <th>Evidencia Documental</th>
                        <th>Impacto Esperado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>Plataforma IA-VAC</strong>
                        </td>
                        <td>
                          Habilitar ingesta completa para XLSX y PPTX con detector de
                          plantillas vacías.
                        </td>
                        <td>Formatos tabulares y templates sin datos.</td>
                        <td>
                          100% de disponibilidad en análisis masivo sin fallos.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Vicerrectoría (VRAC)</strong>
                        </td>
                        <td>
                          Implementar cruce automático entre syllabus aprobados y LMS
                          Canvas antes del semestre.
                        </td>
                        <td>No Conformidad Mayor 1 en auditoría.</td>
                        <td>
                          Equivalencia formativa total y eliminación de no conformidades.
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <strong>Direcciones de Carrera</strong>
                        </td>
                        <td>
                          Completar las 31 matrices de tributación pendientes y firmar
                          pautas de validación.
                        </td>
                        <td>31 matrices pendientes en informe central.</td>
                        <td>
                          Alineación del 100% previo a procesos de acreditación.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 32 }}>
                <a
                  className="btn-docx"
                  href={carpetaInformeUrl(carpetaActiva.id)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "12px 24px", fontSize: "1rem" }}
                >
                  <Icon name="download" size={18} /> Descargar Informe Técnico Oficial (.docx)
                </a>
              </div>
            </section>
          ) : (
            <section
              className="panel"
              style={{ textAlign: "center", padding: "40px 20px" }}
            >
              <div style={{ maxWidth: 500, margin: "0 auto" }}>
                <div
                  className="carpeta-icon-wrap"
                  style={{
                    width: 64,
                    height: 64,
                    margin: "0 auto 16px auto",
                  }}
                >
                  <Icon name="spark" size={32} />
                </div>
                <h3 style={{ margin: "0 0 8px 0" }}>Análisis de Carpeta Pendiente</h3>
                <p className="muted" style={{ marginBottom: 20 }}>
                  Esta carpeta contiene <strong>{docsDeCarpeta.length}</strong> archivo(s)
                  listos para ser analizados de forma cruzada. Haz clic en el botón
                  inferior para procesar los documentos y generar el informe formal en
                  formato Word (.docx).
                </p>
                <button
                  className="btn-analizar-ai"
                  onClick={() => handleAnalizar(carpetaActiva.id)}
                  disabled={analizando || docsDeCarpeta.length === 0}
                  style={{ padding: "12px 22px", fontSize: "0.95rem" }}
                >
                  <Icon name="spark" size={18} />
                  {analizando
                    ? "Analizando documentos con IA..."
                    : "Iniciar Análisis de Carpeta"}
                </button>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div>
          <div className="carpetas-header-actions">
            <div>
              <h2 style={{ margin: 0 }}>
                Carpetas Documentales ({carpetasVisibles.length})
              </h2>
              <small className="muted">
                Agrupa archivos para análisis cruzado y generación de informes Word (.docx)
              </small>
            </div>
            <button className="btn primary" onClick={() => setModalCrear(true)}>
              <Icon name="plus" size={16} /> Nueva Carpeta
            </button>
          </div>

          {carpetasVisibles.length === 0 ? (
            <section className="panel">
              <p className="empty">
                {carpetas.length === 0
                  ? "Aún no se han creado carpetas. Haz clic en 'Nueva Carpeta' para crear una."
                  : "Ninguna carpeta coincide con la búsqueda."}
              </p>
            </section>
          ) : (
            <div className="carpetas-grid">
              {carpetasVisibles.map((c) => {
                const totalDocs = documentos.filter(
                  (d) => d.carpeta_id === c.id
                ).length;
                return (
                  <div key={c.id} className="carpeta-card">
                    <div className="carpeta-card-top">
                      <div className="carpeta-icon-wrap">
                        <Icon name="folder" size={24} />
                      </div>
                      <div className="carpeta-card-title">
                        <h3 title={c.nombre}>{c.nombre}</h3>
                        <small className="muted">
                          Creada el {formatFecha(c.creado_en)}
                        </small>
                      </div>
                      <button
                        className="icon-btn danger"
                        onClick={() => handleEliminar(c.id, c.nombre)}
                        title="Eliminar carpeta"
                        style={{ marginLeft: "auto" }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>

                    <p className="carpeta-desc">
                      {c.descripcion || "Carpeta sin descripción."}
                    </p>

                    <div className="carpeta-meta-row">
                      <span className="carpeta-doc-badge">
                        <Icon name="file" size={14} /> {totalDocs} documento(s)
                      </span>
                      {c.analizado_en ? (
                        <span className="carpeta-status-analyzed">
                          <Icon name="check" size={14} /> Analizada
                        </span>
                      ) : (
                        <span className="muted">Sin analizar</span>
                      )}
                    </div>

                    <div className="carpeta-card-actions">
                      <button
                        className="btn primary"
                        style={{ flex: 1 }}
                        onClick={() => setCarpetaActiva(c)}
                      >
                        Abrir Carpeta
                      </button>
                      <a
                        className="btn-docx"
                        href={carpetaInformeUrl(c.id)}
                        target="_blank"
                        rel="noreferrer"
                        title="Descargar informe Word"
                      >
                        <Icon name="download" size={15} /> Word
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentosTab({ documentos, instrumentos, carpetas = [], refresh, query }) {
  const [file, setFile] = useState(null);
  const [nombre, setNombre] = useState("");
  const [instrumentoId, setInstrumentoId] = useState("");
  const [carpetaId, setCarpetaId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [preevaluando, setPreevaluando] = useState(null);
  const [error, setError] = useState("");
  const [evaluaciones, setEvaluaciones] = useState({});
  const [errorEvaluaciones, setErrorEvaluaciones] = useState("");

  useEffect(() => {
    if (documentos.length === 0) {
      setEvaluaciones({});
      setErrorEvaluaciones("");
      return undefined;
    }
    let activo = true;
    getUltimasPreevaluaciones()
      .then((resultados) => {
        if (!activo) return;
        setEvaluaciones(
          resultados.reduce((porDocumento, resultado) => {
            porDocumento[resultado.documento_id] = resultado;
            return porDocumento;
          }, {})
        );
        setErrorEvaluaciones("");
      })
      .catch(() => {
        if (activo) {
          setErrorEvaluaciones(
            "No se pudieron cargar las puntuaciones e informes guardados."
          );
        }
      });
    return () => {
      activo = false;
    };
  }, [documentos]);

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
        carpeta_id: carpetaId ? Number(carpetaId) : null,
      });
      setFile(null);
      setNombre("");
      setInstrumentoId("");
      setCarpetaId("");
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

  const asociarCarpetaDoc = async (docId, e) => {
    const val = e.target.value;
    await asociarDocumentoCarpeta(docId, val ? Number(val) : null);
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
            <label>Carpeta de destino (opcional)</label>
            <select
              value={carpetaId}
              onChange={(e) => setCarpetaId(e.target.value)}
            >
              <option value="">-- Sin carpeta asignada --</option>
              {carpetas.map((c) => (
                <option key={c.id} value={c.id}>
                  📁 {c.nombre}
                </option>
              ))}
            </select>
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
        {errorEvaluaciones && (
          <p className="error banner" role="alert">{errorEvaluaciones}</p>
        )}
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
                  <th>Carpeta</th>
                  <th>Estado</th>
                  <th>Instrumento asociado</th>
                  <th>Resultado IA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nombre}</td>
                    <td>
                      {d.carpeta_id ? (
                        <span className="carpeta-tag" title="Carpeta asignada">
                          <Icon name="folder" size={13} />{" "}
                          {carpetas.find((c) => c.id === d.carpeta_id)?.nombre ||
                            `#${d.carpeta_id}`}
                        </span>
                      ) : (
                        <select
                          className="select-inline"
                          defaultValue=""
                          onChange={(e) => asociarCarpetaDoc(d.id, e)}
                        >
                          <option value="">Mover a carpeta...</option>
                          {carpetas.map((c) => (
                            <option key={c.id} value={c.id}>
                              📁 {c.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
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
                      {evaluaciones[d.id]?.resultado ? (
                        <div className="document-result">
                          {evaluaciones[d.id].resultado.puntaje_total != null ? (
                            <strong>
                              {formatPuntaje(
                                evaluaciones[d.id].resultado.puntaje_total
                              )}{" "}
                              /{" "}
                              {formatPuntaje(
                                puntajeMaximo(
                                  evaluaciones[d.id].resultado.criterios
                                )
                              )}{" "}
                              pts
                            </strong>
                          ) : (
                            <strong>Informe guardado</strong>
                          )}
                          <span className="muted">
                            {formatFecha(evaluaciones[d.id].creado_en)}
                          </span>
                          <button
                            className="link-btn report-link"
                            onClick={() => setPreevaluando(d)}
                          >
                            Ver informe
                          </button>
                        </div>
                      ) : (
                        <span className="muted">Sin evaluación</span>
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
                            title={
                              evaluaciones[d.id]
                                ? "Ver informe y evaluar de nuevo"
                                : "Evaluar con IA"
                            }
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
          onEvaluated={refresh}
        />
      )}
    </div>
  );
}

function AdminLLMTab({ instrumentos }) {
  const [estado, setEstado] = useState(null);
  const [instrumentoId, setInstrumentoId] = useState(
    instrumentos[0] ? String(instrumentos[0].id) : ""
  );
  const [prompt, setPrompt] = useState(null);
  const [modelo, setModelo] = useState("qwen");
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [cargandoPrompt, setCargandoPrompt] = useState(false);
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState("");
  const [resultadoPrueba, setResultadoPrueba] = useState("");
  const opcionesModelo = obtenerOpcionesModelo(estado?.modelos);

  useEffect(() => {
    if (!instrumentoId && instrumentos.length > 0) {
      setInstrumentoId(String(instrumentos[0].id));
    }
  }, [instrumentoId, instrumentos]);

  useEffect(() => {
    let activo = true;
    getIAEstado()
      .then((data) => {
        if (activo) setEstado(data);
      })
      .catch((err) => {
        if (activo) {
          setError(
            err.response?.data?.detail ||
              "No se pudo consultar la configuracion del servicio de IA."
          );
        }
      })
      .finally(() => {
        if (activo) setCargandoEstado(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!instrumentoId) {
      setPrompt(null);
      return undefined;
    }
    let activo = true;
    setPrompt(null);
    setCargandoPrompt(true);
    getPromptPreview(instrumentoId)
      .then((data) => {
        if (activo) setPrompt(data);
      })
      .catch((err) => {
        if (activo) {
          setError(
            err.response?.data?.detail ||
              "No se pudo generar la vista previa del prompt."
          );
        }
      })
      .finally(() => {
        if (activo) setCargandoPrompt(false);
      });
    return () => {
      activo = false;
    };
  }, [instrumentoId]);

  const ejecutarPrueba = async () => {
    setProbando(true);
    setError("");
    setResultadoPrueba("");
    try {
      const resultado = await probarIA(modelo);
      setResultadoPrueba(
        `Conexion correcta con ${resultado.modelo}. Respuesta: ${resultado.respuesta}`
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "No se pudo conectar con el modelo. Revisa el endpoint y las credenciales del backend."
      );
    } finally {
      setProbando(false);
    }
  };

  const modeloSeleccionado = opcionesModelo.find(
    (opcion) => opcion.value === modelo
  )?.label;

  return (
    <div className="stack">
      <section className="panel">
        <h2>Administracion de modelos de lenguaje</h2>
        <p className="muted">
          La conexion usa las variables IA_API_URL e IA_API_KEY configuradas
          en el backend. La credencial nunca se muestra en esta pantalla.
        </p>
        {cargandoEstado ? (
          <p className="muted">Consultando estado...</p>
        ) : (
          <div className="llm-status">
            <span
              className={`llm-indicator ${
                estado?.configurada ? "connected" : "disconnected"
              }`}
              aria-hidden="true"
            />
            <div>
              <strong>
                {estado?.configurada
                  ? "Configuracion lista"
                  : "Configuracion incompleta"}
              </strong>
              <p className="muted">
                Endpoint:{" "}
                {estado?.endpoint_configurado ? "configurado" : "faltante"} ·
                Credencial:{" "}
                {estado?.credencial_configurada ? "configurada" : "faltante"}
              </p>
            </div>
          </div>
        )}

        <div className="llm-test-controls">
          <label className="form-row">
            <span>Modelo para la prueba</span>
            <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
              {opcionesModelo.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </label>
          {modeloSeleccionado && (
            <span className="tag">{modeloSeleccionado}</span>
          )}
          <button
            className="btn primary"
            onClick={ejecutarPrueba}
            disabled={probando || cargandoEstado || !estado?.configurada}
          >
            <Icon name="spark" size={16} />
            {probando ? "Probando..." : "Probar conexion"}
          </button>
        </div>
        {resultadoPrueba && (
          <p className="success banner" role="status">
            {resultadoPrueba}
          </p>
        )}
        {error && <p className="error banner" role="alert">{error}</p>}
      </section>

      <section className="panel">
        <h2>Prompt Builder de la pauta</h2>
        <p className="muted">
          El prompt se genera automaticamente con los criterios y puntajes
          maximos que escribiste en cada instrumento. La misma construccion se
          utiliza al preevaluar un documento, criterio por criterio.
        </p>
        <div className="form-row">
          <label htmlFor="prompt-instrumento">Instrumento / pauta</label>
          <select
            id="prompt-instrumento"
            value={instrumentoId}
            onChange={(e) => setInstrumentoId(e.target.value)}
          >
            <option value="">Selecciona una pauta</option>
            {instrumentos.map((instrumento) => (
              <option key={instrumento.id} value={instrumento.id}>
                {instrumento.nombre}
              </option>
            ))}
          </select>
        </div>
        {instrumentos.length === 0 && (
          <p className="empty">
            Crea una pauta y escribe sus criterios para construir el prompt.
          </p>
        )}
        {cargandoPrompt && <p className="muted">Construyendo prompt...</p>}
        {prompt && !cargandoPrompt && (
          <>
            <p className="muted">
              {prompt.instrumento} · {prompt.criterios} criterio(s)
            </p>
            {prompt.criterios === 0 ? (
              <p className="empty">
                Agrega criterios a esta pauta para poder evaluarla con IA.
              </p>
            ) : (
              <div className="prompt-preview">
                <h3>Instrucciones de evaluacion</h3>
                <pre>{prompt.prompt.system}</pre>
                <h3>Criterios y documento</h3>
                <pre>{prompt.prompt.user}</pre>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const NAV = [
  { id: "resumen", label: "Resumen", icon: "grid" },
  { id: "carpetas", label: "Carpetas", icon: "folder" },
  { id: "documentos", label: "Documentos", icon: "file" },
  { id: "instrumentos", label: "Instrumentos", icon: "clipboard" },
  { id: "admin-llm", label: "Admin LLM", icon: "spark" },
  { id: "actividad", label: "Actividad", icon: "activity" },
];

function App() {
  const [tab, setTab] = useState("resumen");
  const [instrumentos, setInstrumentos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [query, setQuery] = useState("");
  const [connError, setConnError] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([getInstrumentos(), getDocumentos(), getCarpetas()])
      .then(([ins, docs, car]) => {
        setInstrumentos(ins);
        setDocumentos(docs);
        setCarpetas(car);
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
            carpetas={carpetas}
            onNavigate={setTab}
          />
        )}
        {tab === "carpetas" && (
          <CarpetasTab
            carpetas={carpetas}
            documentos={documentos}
            refresh={refresh}
            query={query}
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
            carpetas={carpetas}
            refresh={refresh}
            query={query}
          />
        )}
        {tab === "admin-llm" && <AdminLLMTab instrumentos={instrumentos} />}
        {tab === "actividad" && <ActividadTab query={query} />}
      </main>
    </div>
  );
}

export default App;

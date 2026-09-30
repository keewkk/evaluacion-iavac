import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

// ---- Instrumentos ----
export const getInstrumentos = () =>
  api.get("/instrumentos").then((res) => res.data);

export const createInstrumento = (instrumento) =>
  api.post("/instrumentos", instrumento).then((res) => res.data);

export const updateInstrumento = (id, instrumento) =>
  api.put(`/instrumentos/${id}`, instrumento).then((res) => res.data);

export const deleteInstrumento = (id) => api.delete(`/instrumentos/${id}`);

// ---- Documentos ----
export const getDocumentos = () =>
  api.get("/documentos").then((res) => res.data);

export const uploadDocumento = ({ file, nombre, tipo, instrumento_id }) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("nombre", nombre);
  if (tipo) formData.append("tipo", tipo);
  if (instrumento_id) formData.append("instrumento_id", instrumento_id);
  return api
    .post("/documentos", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((res) => res.data);
};

export const asociarDocumento = (id, instrumento_id) =>
  api
    .put(`/documentos/${id}/asociar`, { instrumento_id })
    .then((res) => res.data);

export const deleteDocumento = (id) => api.delete(`/documentos/${id}`);

export const archivoUrl = (id, descargar = false) =>
  `${API_URL}/api/documentos/${id}/archivo${descargar ? "?descargar=true" : ""}`;

// ---- Preevaluacion IA (M2 - Qwen / Gemma) ----
export const preevaluarDocumento = (documentoId, modelo = "qwen") =>
  api
    .post(`/documentos/${documentoId}/preevaluar`, { modelo })
    .then((res) => res.data);

export const getPreevaluaciones = (documentoId) =>
  api.get(`/documentos/${documentoId}/preevaluaciones`).then((res) => res.data);

// ---- Log de auditoria (M3 - trazabilidad) ----
export const getLogs = (entidad) =>
  api
    .get("/logs", { params: entidad ? { entidad } : {} })
    .then((res) => res.data);

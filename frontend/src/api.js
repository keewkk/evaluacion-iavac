import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

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
export const getDocumentos = (carpetaId = null) =>
  api
    .get("/documentos", { params: carpetaId ? { carpeta_id: carpetaId } : {} })
    .then((res) => res.data);

export const uploadDocumento = ({ file, nombre, tipo, instrumento_id, carpeta_id }) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("nombre", nombre);
  if (tipo) formData.append("tipo", tipo);
  if (instrumento_id) formData.append("instrumento_id", instrumento_id);
  if (carpeta_id) formData.append("carpeta_id", carpeta_id);
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

export const asociarDocumentoCarpeta = (id, carpeta_id) =>
  api
    .put(`/documentos/${id}/carpeta`, { carpeta_id })
    .then((res) => res.data);

export const deleteDocumento = (id) => api.delete(`/documentos/${id}`);

export const archivoUrl = (id, descargar = false) =>
  `${API_URL}/api/documentos/${id}/archivo${descargar ? "?descargar=true" : ""}`;

// ---- Carpetas y Análisis Transversal ----
export const getCarpetas = () =>
  api.get("/carpetas").then((res) => res.data);

export const getCarpeta = (id) =>
  api.get(`/carpetas/${id}`).then((res) => res.data);

export const createCarpeta = (carpeta) =>
  api.post("/carpetas", carpeta).then((res) => res.data);

export const updateCarpeta = (id, carpeta) =>
  api.put(`/carpetas/${id}`, carpeta).then((res) => res.data);

export const deleteCarpeta = (id) => api.delete(`/carpetas/${id}`);

export const analizarCarpeta = (carpetaId) =>
  api.post(`/carpetas/${carpetaId}/analizar`).then((res) => res.data);

export const carpetaInformeUrl = (carpetaId) =>
  `${API_URL}/api/carpetas/${carpetaId}/informe`;

// ---- Preevaluacion IA (M2 - Qwen / Gemma) ----
export const preevaluarDocumento = (documentoId, modelo = "qwen") =>
  api
    .post(`/documentos/${documentoId}/preevaluar`, { modelo })
    .then((res) => res.data);

export const getPreevaluaciones = (documentoId) =>
  api.get(`/documentos/${documentoId}/preevaluaciones`).then((res) => res.data);

export const getUltimasPreevaluaciones = () =>
  api.get("/preevaluaciones/ultimas").then((res) => res.data);

// ---- Admin LLM / constructor de prompts ----
export const getIAEstado = () => api.get("/ia/estado").then((res) => res.data);

export const probarIA = (modelo = "qwen") =>
  api.post("/ia/probar", { modelo }).then((res) => res.data);

export const getPromptPreview = (instrumentoId) =>
  api.get(`/instrumentos/${instrumentoId}/prompt`).then((res) => res.data);

// ---- Log de auditoria (M3 - trazabilidad) ----
export const getLogs = (entidad) =>
  api
    .get("/logs", { params: entidad ? { entidad } : {} })
    .then((res) => res.data);

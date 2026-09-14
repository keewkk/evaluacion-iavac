// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Detalle de Salida Pedagógica
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const destinoId = params.get('id');

  if (!destinoId) {
    window.location.href = 'destinos.html';
    return;
  }

  cargarDetalle(destinoId);
});

async function cargarDetalle(id) {
  const container = document.getElementById('detalle-container');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet(`/destinos/${id}`);

    if (!res.ok) {
      container.innerHTML = '<div class="empty-state"><div class="icon">😕</div><h3>Salida no encontrada</h3><p><a href="destinos.html" class="btn btn-outline">Ver todas las salidas</a></p></div>';
      return;
    }

    const d = res.data;
    const cuposDisp = d.cupos_disponibles != null ? d.cupos_disponibles : d.cupos;
    const sinCupos = cuposDisp <= 0;
    const cuposBadgeClass = sinCupos ? 'style="background:rgba(214,48,49,0.1);color:var(--error);"' : '';

    container.innerHTML = `
      <!-- Header con imagen -->
      <div class="detalle-header">
        <img src="${d.imagen_url}" alt="${d.nombre}" onerror="handleImgError(this)">
        <div class="overlay">
          <span class="pais-badge">📍 ${d.region}</span>
          <h1>${d.nombre}</h1>
        </div>
      </div>

      <!-- Contenido -->
      <div class="container">
        <div class="detalle-body">
          <!-- Información principal -->
          <div class="detalle-info">
            <h2>Sobre esta salida pedagógica</h2>
            <p>${d.descripcion}</p>

            <div class="detalle-datos">
              <div class="dato-item">
                <div class="dato-label">Duración</div>
                <div class="dato-valor">📅 ${d.duracion_dias} día(s)</div>
              </div>
              <div class="dato-item">
                <div class="dato-label">Capacidad Van</div>
                <div class="dato-valor" ${sinCupos ? 'style="color:var(--error)"' : ''}>👥 ${cuposDisp} / ${d.cupos} asientos</div>
              </div>
              <div class="dato-item">
                <div class="dato-label">Fecha de salida</div>
                <div class="dato-valor">${formatFecha(d.fecha_inicio)}</div>
              </div>
              <div class="dato-item">
                <div class="dato-label">Fecha de regreso</div>
                <div class="dato-valor">${formatFecha(d.fecha_fin)}</div>
              </div>
            </div>

            <h2>¿Qué incluye?</h2>
            <ul style="color: var(--texto-suave); margin-bottom: 1.5rem; padding-left: 1.5rem;">
              <li>Transporte ida y vuelta en Van institucional de 20 asientos con selección de asiento</li>
              <li>Guía académica especializada</li>
              <li>Material de terreno y equipamiento</li>
              <li>Alimentación durante la salida</li>
              <li>Seguro escolar institucional</li>
              <li>Certificado de participación</li>
            </ul>
          </div>

          <!-- Sidebar precio -->
          <div class="detalle-sidebar">
            <div class="precio-card">
              <div class="precio-monto">${formatPrecio(d.precio)}</div>
              <div class="precio-persona">por persona</div>
              <div class="cupos-badge" ${cuposBadgeClass}>${sinCupos ? '❌ Sin cupos disponibles' : `✅ ${cuposDisp} cupos disponibles`}</div>
              ${sinCupos
                ? '<button class="btn btn-gold" disabled>Sin cupos disponibles</button>'
                : `<a href="reservar.html?id=${d.id}" class="btn btn-gold">🎫 Inscribirme ahora</a>`
              }
              <div style="margin-top: 1rem;">
                <a href="destinos.html" class="btn btn-outline" style="font-size: 0.9rem; padding: 0.5rem 1rem;">← Volver a salidas</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Error al cargar la salida</h3><p>Intenta recargar la página</p></div>';
  }
}

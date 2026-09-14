// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Catálogo de Salidas Pedagógicas
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('destinos-grid');
  const searchInput = document.getElementById('filtro-buscar');
  const paisSelect = document.getElementById('filtro-pais');
  const ordenSelect = document.getElementById('filtro-orden');

  let todosDestinos = [];

  // ── Cargar salidas ───────────────────────────────────────
  async function cargarDestinos() {
    grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const res = await apiGet('/destinos');
      if (res.ok) {
        todosDestinos = res.data;
        poblarFiltroRegiones();
        renderDestinos(todosDestinos);
      }
    } catch (error) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Error al cargar las salidas</h3><p>Intenta recargar la página</p></div>';
    }
  }

  // ── Poblar select de regiones ───────────────────────────────
  function poblarFiltroRegiones() {
    const regiones = [...new Set(todosDestinos.map(d => d.region))].sort();
    regiones.forEach(region => {
      const opt = document.createElement('option');
      opt.value = region;
      opt.textContent = region;
      paisSelect.appendChild(opt);
    });
  }

  // ── Renderizar salidas ───────────────────────────────────
  function renderDestinos(destinos) {
    if (destinos.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>No se encontraron salidas</h3><p>Intenta con otros filtros</p></div>';
      return;
    }

    grid.innerHTML = destinos.map(d => {
      const cuposDisp = d.cupos_disponibles != null ? d.cupos_disponibles : d.cupos;
      const cuposClass = cuposDisp <= 3 ? 'style="color: var(--error); font-weight: 700;"' : '';
      return `
        <div class="destino-card" onclick="window.location.href='detalle.html?id=${d.id}'">
          <img class="card-img" src="${d.imagen_url}" alt="${d.nombre}" onerror="handleImgError(this)">
          <div class="card-body">
            <span class="card-pais">📍 ${d.region}</span>
            <h3>${d.nombre}</h3>
            <p class="card-desc">${d.descripcion}</p>
            <div class="card-footer">
              <div class="card-precio">${formatPrecio(d.precio)} <small>/persona</small></div>
              <div class="card-info">
                <span>📅 ${d.duracion_dias} día(s)</span>
                <span ${cuposClass}>🚐 ${cuposDisp} asientos</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Filtrar salidas ──────────────────────────────────────
  function filtrar() {
    let resultado = [...todosDestinos];
    const busqueda = searchInput.value.toLowerCase().trim();
    const region = paisSelect.value;
    const orden = ordenSelect.value;

    if (busqueda) {
      resultado = resultado.filter(d =>
        d.nombre.toLowerCase().includes(busqueda) ||
        d.region.toLowerCase().includes(busqueda) ||
        d.descripcion.toLowerCase().includes(busqueda)
      );
    }

    if (region) {
      resultado = resultado.filter(d => d.region === region);
    }

    switch (orden) {
      case 'precio-asc': resultado.sort((a, b) => a.precio - b.precio); break;
      case 'precio-desc': resultado.sort((a, b) => b.precio - a.precio); break;
      case 'duracion': resultado.sort((a, b) => a.duracion_dias - b.duracion_dias); break;
      case 'fecha': resultado.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio)); break;
    }

    renderDestinos(resultado);
  }

  // ── Event listeners ───────────────────────────────────────
  searchInput.addEventListener('input', filtrar);
  paisSelect.addEventListener('change', filtrar);
  ordenSelect.addEventListener('change', filtrar);

  cargarDestinos();
});

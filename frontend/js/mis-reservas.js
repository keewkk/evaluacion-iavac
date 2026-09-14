// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Mis Inscripciones
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');

  if (email) {
    document.getElementById('buscar-email').value = email;
    buscarReservas(email);
  }

  // Setup búsqueda
  const form = document.getElementById('form-buscar');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('buscar-email').value.trim();
    if (emailInput) {
      buscarReservas(emailInput);
    }
  });
});

async function buscarReservas(email) {
  const lista = document.getElementById('reservas-lista');
  lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const res = await apiGet(`/reservas?email=${encodeURIComponent(email)}`);

    if (!res.ok) {
      lista.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Error al buscar inscripciones</h3></div>';
      return;
    }

    if (res.data.length === 0) {
      lista.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <h3>No se encontraron inscripciones</h3>
          <p>No hay inscripciones asociadas a <strong>${email}</strong></p>
          <a href="destinos.html" class="btn btn-outline" style="margin-top: 1rem; display: inline-flex;">Explorar salidas</a>
        </div>
      `;
      return;
    }

    lista.innerHTML = `
      <p style="text-align:center; color: var(--texto-suave); margin-bottom: 1.5rem;">
        Se encontraron <strong>${res.total}</strong> inscripción(es) para <strong>${email}</strong>
      </p>
      ${res.data.map(r => `
        <div class="reserva-card" id="reserva-${r.id}">
          <img src="${r.imagen_url}" alt="${r.destino_nombre}" onerror="handleImgError(this)">
          <div class="reserva-info">
            <h3>${r.destino_nombre}</h3>
            <div class="reserva-detalles">
              <span>📍 ${r.region}</span>
              <span>👤 ${r.nombre_pasajero}</span>
              <span>👥 ${r.num_personas} persona(s)</span>
              <span style="font-weight:700; color:var(--unab-azul)">🚐 Asiento(s): ${r.asientos || '—'}</span>
            </div>
            <div class="reserva-detalles">
              <span>📅 ${formatFecha(r.fecha_inicio)} → ${formatFecha(r.fecha_fin)}</span>
              <span>💰 ${formatPrecio(r.precio * r.num_personas)}</span>
            </div>
            <span class="estado-badge estado-${r.estado}">${r.estado}</span>
            ${r.notas ? `<p style="font-size: 0.85rem; color: var(--texto-suave); margin-top: 0.5rem;">📝 ${r.notas}</p>` : ''}
          </div>
          <div class="reserva-acciones">
            ${r.estado === 'confirmada' ? `
              <button class="btn btn-danger" onclick="cancelarReserva(${r.id})">
                ✕ Cancelar
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    `;
  } catch (error) {
    lista.innerHTML = '<div class="empty-state"><div class="icon">❌</div><h3>Error de conexión</h3><p>Intenta de nuevo más tarde</p></div>';
  }
}

async function cancelarReserva(id) {
  if (!confirm('¿Estás seguro de que deseas cancelar esta inscripción?')) return;

  try {
    const res = await apiDelete(`/reservas/${id}`);
    if (res.ok) {
      // Recargar inscripciones
      const email = document.getElementById('buscar-email').value.trim();
      buscarReservas(email);
      mostrarAlerta('alerta-reservas', 'exito', 'Inscripción cancelada exitosamente');
    } else {
      mostrarAlerta('alerta-reservas', 'error', res.error || 'Error al cancelar');
    }
  } catch (error) {
    mostrarAlerta('alerta-reservas', 'error', 'Error de conexión');
  }
}

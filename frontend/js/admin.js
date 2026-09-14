// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Panel de Administración
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  cargarDashboard();
  cargarReservas();
  cargarDestinos();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
});

// ── Dashboard ─────────────────────────────────────────────────
async function cargarDashboard() {
  try {
    const res = await apiGet('/admin/dashboard');
    if (res.ok) {
      const d = res.data;
      document.getElementById('stat-destinos').textContent = d.totalDestinos;
      document.getElementById('stat-reservas').textContent = d.totalReservas;
      document.getElementById('stat-confirmadas').textContent = d.reservasConfirmadas;
      document.getElementById('stat-canceladas').textContent = d.reservasCanceladas;
      document.getElementById('stat-ingresos').textContent = formatPrecio(d.costoTotal);
      document.getElementById('stat-pasajeros').textContent = d.totalPasajeros;
    }
  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

// ── Inscripciones ──────────────────────────────────────────────
async function cargarReservas() {
  const tbody = document.getElementById('tabla-reservas');
  tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Cargando...</td></tr>';

  try {
    const res = await apiGet('/admin/reservas');
    if (res.ok) {
      if (res.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">No hay inscripciones aún</td></tr>';
        return;
      }

      tbody.innerHTML = res.data.map(r => `
        <tr class="${r.estado === 'cancelada' ? 'fila-cancelada' : ''}">
          <td><strong>#${r.id}</strong></td>
          <td>${r.nombre_pasajero}</td>
          <td><a href="mailto:${r.email}">${r.email}</a></td>
          <td>${r.telefono || '—'}</td>
          <td>${r.destino_nombre}<br><small style="color:var(--texto-suave)">📍 ${r.region}</small></td>
          <td style="text-align:center"><span style="background:#e0f2fe; color:#0369a1; padding:0.2rem 0.5rem; border-radius:6px; font-weight:700; font-size:0.85rem;">🚐 ${r.asientos || '—'}</span></td>
          <td style="text-align:center">${r.num_personas}</td>
          <td><span class="estado-badge estado-${r.estado}">${r.estado}</span></td>
          <td style="font-size:0.85rem;color:var(--texto-suave)">${formatFechaHora(r.fecha_reserva)}</td>
        </tr>
      `).join('');

      document.getElementById('total-reservas-tabla').textContent = `(${res.total} registros)`;
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--error);">Error al cargar inscripciones</td></tr>';
  }
}

// ── Salidas ──────────────────────────────────────────────────
async function cargarDestinos() {
  const tbody = document.getElementById('tabla-destinos');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;">Cargando...</td></tr>';

  try {
    const res = await apiGet('/admin/destinos');
    if (res.ok) {
      tbody.innerHTML = res.data.map(d => {
        const cuposUsados = d.pasajeros_confirmados || 0;
        const porcentaje = Math.round((cuposUsados / d.cupos) * 100);
        return `
          <tr>
            <td><strong>#${d.id}</strong></td>
            <td>
              <strong>${d.nombre}</strong><br>
              <small style="color:var(--texto-suave)">📍 ${d.region}</small>
            </td>
            <td style="text-align:right">${formatPrecio(d.precio)}</td>
            <td style="text-align:center">${d.duracion_dias} día(s)</td>
            <td style="text-align:center">${d.total_reservas}</td>
            <td>
              <div class="barra-cupos">
                <div class="barra-fill" style="width:${Math.min(porcentaje, 100)}%;background:${porcentaje > 80 ? 'var(--error)' : porcentaje > 50 ? 'var(--unab-dorado)' : 'var(--exito)'}"></div>
              </div>
              <small>${cuposUsados}/${d.cupos} (${porcentaje}%)</small>
            </td>
            <td style="font-size:0.85rem">${formatFecha(d.fecha_inicio)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--error);">Error al cargar salidas</td></tr>';
  }
}

// ── Utilidades ────────────────────────────────────────────────
function formatFechaHora(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function exportarCSV() {
  apiGet('/admin/reservas').then(res => {
    if (!res.ok || res.data.length === 0) return alert('No hay datos para exportar');

    const headers = ['ID', 'Estudiante', 'Email', 'Teléfono', 'Salida', 'Región', 'Asientos Van', 'Personas', 'Estado', 'Fecha Inscripción', 'Costo Total'];
    const rows = res.data.map(r => [
      r.id, r.nombre_pasajero, r.email, r.telefono || '', r.destino_nombre,
      r.region, r.asientos || '', r.num_personas, r.estado, r.fecha_reserva, r.precio * r.num_personas
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inscripciones_salidas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  });
}

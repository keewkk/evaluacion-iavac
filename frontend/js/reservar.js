// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Formulario de Inscripción con Selección de Asientos (Van de 20)
// ══════════════════════════════════════════════════════════════

let currentDestino = null;
let selectedSeats = [];

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const destinoId = params.get('id');

  if (!destinoId) {
    window.location.href = 'destinos.html';
    return;
  }

  cargarDestinoReserva(destinoId);
  setupFormulario(destinoId);
});

// ── Cargar información del destino y asientos ocupados ───────
async function cargarDestinoReserva(id) {
  const resumen = document.getElementById('destino-resumen');

  try {
    const res = await apiGet(`/destinos/${id}`);
    if (res.ok) {
      currentDestino = res.data;
      const d = currentDestino;
      const cuposDisp = d.cupos_disponibles != null ? d.cupos_disponibles : d.cupos;

      resumen.innerHTML = `
        <img src="${d.imagen_url}" alt="${d.nombre}" onerror="handleImgError(this)">
        <div class="info">
          <h3>${d.nombre}</h3>
          <p>📍 ${d.region} · 📅 ${d.duracion_dias} día(s) · ${formatPrecio(d.precio)} /persona</p>
          <p>${formatFecha(d.fecha_inicio)} → ${formatFecha(d.fecha_fin)} · 👥 <strong>${cuposDisp}</strong> cupos disponibles en Van de 20</p>
        </div>
      `;

      // Renderizar diagrama interactivo de la van
      renderVanSeats(d.asientos_ocupados || []);
    } else {
      resumen.innerHTML = '<p style="color:var(--error)">No se pudo cargar la información de la salida pedagógica</p>';
    }
  } catch (error) {
    resumen.innerHTML = '<p style="color:var(--error)">Error al conectar con el servidor</p>';
  }
}

// ── Renderizar los 20 asientos de la Van ─────────────────────
function renderVanSeats(ocupados) {
  const container = document.getElementById('van-seats-container');
  if (!container) return;

  const ocupadosSet = new Set(ocupados.map(n => Number(n)));

  // Definición de filas de la van de 20 asientos:
  // Fila 0: [ vacío ] [ vacío ] | pasillo | [ 01 ]
  // Filas 1 a 5 (3 asientos por fila): [ izq1 ] [ izq2 ] | pasillo | [ der1 ]
  // Fila 6 (última fila de 4): [ 17 ] [ 18 ] [ 19 ] [ 20 ]
  const rowsDef = [
    { type: 'partial', seats: [null, null, 1] },
    { type: 'standard', seats: [2, 3, 4] },
    { type: 'standard', seats: [5, 6, 7] },
    { type: 'standard', seats: [8, 9, 10] },
    { type: 'standard', seats: [11, 12, 13] },
    { type: 'standard', seats: [14, 15, 16] },
    { type: 'full', seats: [17, 18, 19, 20] }
  ];

  let html = '';

  rowsDef.forEach((row, rowIndex) => {
    if (row.type === 'full') {
      html += `<div class="van-row full-row" data-row="${rowIndex}">`;
      row.seats.forEach(seatNum => {
        html += renderSeatButton(seatNum, ocupadosSet);
      });
      html += `</div>`;
    } else if (row.type === 'partial') {
      html += `<div class="van-row" data-row="${rowIndex}">`;
      html += `<div></div><div></div>`;
      html += `<div class="aisle-space">▲</div>`;
      html += renderSeatButton(row.seats[2], ocupadosSet);
      html += `</div>`;
    } else {
      // Standard: 2 izq, pasillo, 1 der
      html += `<div class="van-row" data-row="${rowIndex}">`;
      html += renderSeatButton(row.seats[0], ocupadosSet);
      html += renderSeatButton(row.seats[1], ocupadosSet);
      html += `<div class="aisle-space">▲</div>`;
      html += renderSeatButton(row.seats[2], ocupadosSet);
      html += `</div>`;
    }
  });

  container.innerHTML = html;

  // Añadir event listeners a cada asiento disponible
  container.querySelectorAll('.seat-btn:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const seatNum = parseInt(btn.dataset.seat, 10);
      toggleSeatSelection(seatNum);
    });
  });

  actualizarResumenSeleccion();
}

// ── Generar el HTML de un asiento individual ────────────────
function renderSeatButton(seatNum, ocupadosSet) {
  if (!seatNum) return '<div></div>';

  const isOcupado = ocupadosSet.has(seatNum);
  const isSelected = selectedSeats.includes(seatNum);
  const padNum = String(seatNum).padStart(2, '0');

  let classes = ['seat-btn'];
  if (isOcupado) classes.push('ocupado');
  if (isSelected) classes.push('seleccionado');

  const title = isOcupado 
    ? `Asiento ${padNum} - Ocupado` 
    : `Asiento ${padNum} - Clic para ${isSelected ? 'quitar' : 'seleccionar'}`;

  return `
    <button 
      type="button" 
      class="${classes.join(' ')}" 
      data-seat="${seatNum}"
      title="${title}"
      ${isOcupado ? 'disabled' : ''}
    >
      <span class="seat-icon">💺</span>
      <span class="seat-num">${padNum}</span>
    </button>
  `;
}

// ── Alternar selección de asiento ───────────────────────────
function toggleSeatSelection(seatNum) {
  const index = selectedSeats.indexOf(seatNum);
  if (index > -1) {
    selectedSeats.splice(index, 1);
  } else {
    selectedSeats.push(seatNum);
  }

  selectedSeats.sort((a, b) => a - b);

  // Actualizar clases de los botones en el DOM
  const btn = document.querySelector(`.seat-btn[data-seat="${seatNum}"]`);
  if (btn) {
    if (selectedSeats.includes(seatNum)) {
      btn.classList.add('seleccionado');
    } else {
      btn.classList.remove('seleccionado');
    }
  }

  actualizarResumenSeleccion();
}

// ── Actualizar panel de resumen y formulario ────────────────
function actualizarResumenSeleccion() {
  const pillsContainer = document.getElementById('selected-seats-pills');
  const pricePreview = document.getElementById('preview-total-price');
  const asientosDisplay = document.getElementById('asientos-display');
  const numPersonasInput = document.getElementById('num_personas');

  const precioUnitario = currentDestino ? currentDestino.precio : 0;
  const count = selectedSeats.length;
  const totalPrice = precioUnitario * count;

  // Actualizar resumen de pills
  if (count === 0) {
    pillsContainer.innerHTML = `<span style="color: var(--texto-suave); font-size: 0.85rem; font-style: italic;">Ningún asiento seleccionado</span>`;
    pricePreview.textContent = '$0';
    asientosDisplay.value = '';
    numPersonasInput.value = '0';
  } else {
    pillsContainer.innerHTML = selectedSeats.map(s => {
      const padNum = String(s).padStart(2, '0');
      return `
        <span class="seat-pill">
          💺 Asiento ${padNum}
          <span class="remove-seat" onclick="toggleSeatSelection(${s})" title="Quitar asiento">✕</span>
        </span>
      `;
    }).join('');

    pricePreview.textContent = formatPrecio(totalPrice);
    asientosDisplay.value = `Asiento(s): ${selectedSeats.map(s => String(s).padStart(2, '0')).join(', ')} (${count} pasajero${count > 1 ? 's' : ''})`;
    numPersonasInput.value = count;
  }
}

// ── Configurar Formulario ────────────────────────────────────
function setupFormulario(destinoId) {
  const form = document.getElementById('form-reserva');
  const btnSubmit = document.getElementById('btn-reservar');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedSeats.length === 0) {
      mostrarAlerta('alerta-reserva', 'error', '⚠️ Debes seleccionar al menos un asiento en la van antes de continuar');
      document.querySelector('.seat-picker-section').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ Confirmando inscripción...';

    const data = {
      destino_id: parseInt(destinoId, 10),
      nombre_pasajero: document.getElementById('nombre').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefono: document.getElementById('telefono').value.trim(),
      num_personas: selectedSeats.length,
      asientos: selectedSeats,
      notas: document.getElementById('notas').value.trim()
    };

    // Validaciones
    if (!data.nombre_pasajero || !data.email) {
      mostrarAlerta('alerta-reserva', 'error', 'Por favor completa todos los campos obligatorios');
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🎫 Confirmar Inscripción';
      return;
    }

    if (!data.email.includes('@')) {
      mostrarAlerta('alerta-reserva', 'error', 'Por favor ingresa un correo institucional válido');
      btnSubmit.disabled = false;
      btnSubmit.textContent = '🎫 Confirmar Inscripción';
      return;
    }

    try {
      const res = await apiPost('/reservas', data);

      if (res.ok) {
        // Mostrar modal de éxito
        const modal = document.getElementById('modal-exito');
        const detalleModal = document.getElementById('modal-detalle');
        const asientosStr = selectedSeats.map(s => String(s).padStart(2, '0')).join(', ');

        detalleModal.innerHTML = `
          <p><strong>Inscripción #${res.data.id}</strong></p>
          <p>${res.data.destino.nombre}</p>
          <div style="background:#e0f2fe; color:#0369a1; padding:0.6rem 1rem; border-radius:8px; margin:0.8rem 0; font-weight:700;">
            🚐 Asiento(s) en Van: ${res.data.asientos || asientosStr}
          </div>
          <p>Cantidad: ${res.data.num_personas} persona(s) · Costo: ${formatPrecio(res.data.destino.precio * res.data.num_personas)}</p>
          <p style="font-size:0.85rem; margin-top:0.5rem; color: var(--texto-suave);">
            Comprobante enviado a <strong>${res.data.email}</strong>
          </p>
        `;

        modal.classList.add('visible');

        // Limpiar selección
        selectedSeats = [];
        form.reset();
        actualizarResumenSeleccion();

        // Recargar asientos del destino para mostrar los nuevos como ocupados
        cargarDestinoReserva(destinoId);
      } else {
        mostrarAlerta('alerta-reserva', 'error', res.error || 'Error al crear la inscripción');
        // Si hubo conflicto de asiento, recargar ocupados
        cargarDestinoReserva(destinoId);
      }
    } catch (error) {
      mostrarAlerta('alerta-reserva', 'error', 'Error de conexión con el servidor. Intenta nuevamente.');
    }

    btnSubmit.disabled = false;
    btnSubmit.textContent = '🎫 Confirmar Inscripción';
  });
}

function cerrarModal() {
  document.getElementById('modal-exito').classList.remove('visible');
}

function irAMisReservas() {
  const email = document.getElementById('email').value;
  window.location.href = `mis-reservas.html?email=${encodeURIComponent(email)}`;
}

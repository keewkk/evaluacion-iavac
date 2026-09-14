const express = require('express');
const router = express.Router();

// POST /api/reservas — Crear una nueva inscripción con selección de asientos
router.post('/', (req, res) => {
  try {
    const { destino_id, nombre_pasajero, email, telefono, num_personas, asientos, notas } = req.body;

    // Validaciones básicas
    if (!destino_id || !nombre_pasajero || !email) {
      return res.status(400).json({
        ok: false,
        error: 'Campos obligatorios: destino_id, nombre_pasajero, email'
      });
    }

    // Normalizar lista de asientos
    let asientosList = [];
    if (Array.isArray(asientos)) {
      asientosList = asientos.map(s => parseInt(s, 10)).filter(s => !isNaN(s));
    } else if (typeof asientos === 'string' && asientos.trim().length > 0) {
      asientosList = asientos.split(',').map(s => parseInt(s.trim(), 10)).filter(s => !isNaN(s));
    }

    if (asientosList.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Debes seleccionar al menos un asiento en la van'
      });
    }

    // Validar rango de asientos (1 a 20)
    const invalidSeat = asientosList.find(s => s < 1 || s > 20);
    if (invalidSeat !== undefined) {
      return res.status(400).json({
        ok: false,
        error: `El asiento ${invalidSeat} no es válido. Los asientos van del 1 al 20.`
      });
    }

    // Validar duplicados en la selección
    const uniqueSeats = new Set(asientosList);
    if (uniqueSeats.size !== asientosList.length) {
      return res.status(400).json({
        ok: false,
        error: 'No puedes seleccionar el mismo asiento más de una vez'
      });
    }

    // Personas coincide con la cantidad de asientos seleccionados
    const personas = asientosList.length;

    // Usar transacción para evitar condiciones de carrera
    const resultado = req.db.transaction(() => {
      // Verificar que la salida existe
      const destino = req.db.prepare('SELECT * FROM destinos WHERE id = ?').get(destino_id);
      if (!destino) {
        return { error: 'Salida pedagógica no encontrada', status: 404 };
      }

      // Obtener todos los asientos ya reservados en estado 'confirmada'
      const reservasExistentes = req.db.prepare(
        "SELECT asientos FROM reservas WHERE destino_id = ? AND estado = 'confirmada'"
      ).all(destino_id);

      const occupied = new Set();
      reservasExistentes.forEach(r => {
        if (r.asientos) {
          r.asientos.split(',').forEach(s => {
            const num = parseInt(s.trim(), 10);
            if (!isNaN(num)) occupied.add(num);
          });
        }
      });

      // Verificar si alguno de los asientos elegidos ya está tomado
      const conflicto = asientosList.find(s => occupied.has(s));
      if (conflicto) {
        return {
          error: `El asiento #${conflicto} acaba de ser reservado. Por favor elige otro asiento.`,
          status: 400
        };
      }

      // Verificar cupo total
      const cuposDisponibles = destino.cupos - occupied.size;
      if (personas > cuposDisponibles) {
        return {
          error: `No hay suficientes cupos disponibles. Quedan ${cuposDisponibles} asientos.`,
          status: 400
        };
      }

      const asientosStr = asientosList.sort((a, b) => a - b).join(', ');

      // Crear la inscripción
      const result = req.db.prepare(`
        INSERT INTO reservas (destino_id, nombre_pasajero, email, telefono, num_personas, asientos, notas)
        VALUES (@destino_id, @nombre_pasajero, @email, @telefono, @num_personas, @asientos, @notas)
      `).run({
        destino_id,
        nombre_pasajero,
        email,
        telefono: telefono || null,
        num_personas: personas,
        asientos: asientosStr,
        notas: notas || null
      });

      const reserva = req.db.prepare('SELECT * FROM reservas WHERE id = ?').get(result.lastInsertRowid);

      return {
        ok: true,
        data: {
          ...reserva,
          destino,
          cupos_disponibles: cuposDisponibles - personas
        }
      };
    })();

    if (resultado.error) {
      return res.status(resultado.status).json({ ok: false, error: resultado.error });
    }

    res.status(201).json({
      ok: true,
      mensaje: '¡Inscripción confirmada exitosamente con tus asientos asignados!',
      data: resultado.data
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/reservas?email=... — Consultar inscripciones por email
router.get('/', (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Parámetro "email" requerido' });
    }

    const reservas = req.db.prepare(`
      SELECT r.*, d.nombre as destino_nombre, d.region, d.precio, d.duracion_dias,
             d.fecha_inicio, d.fecha_fin, d.imagen_url
      FROM reservas r
      JOIN destinos d ON r.destino_id = d.id
      WHERE r.email = ?
      ORDER BY r.fecha_reserva DESC
    `).all(email);

    res.json({ ok: true, total: reservas.length, data: reservas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// DELETE /api/reservas/:id — Cancelar una inscripción y liberar los asientos
router.delete('/:id', (req, res) => {
  try {
    const reserva = req.db.prepare('SELECT * FROM reservas WHERE id = ?').get(req.params.id);
    if (!reserva) {
      return res.status(404).json({ ok: false, error: 'Inscripción no encontrada' });
    }

    if (reserva.estado === 'cancelada') {
      return res.status(400).json({ ok: false, error: 'La inscripción ya está cancelada' });
    }

    req.db.prepare("UPDATE reservas SET estado = 'cancelada' WHERE id = ?").run(req.params.id);

    res.json({ ok: true, mensaje: 'Inscripción cancelada y asientos liberados exitosamente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

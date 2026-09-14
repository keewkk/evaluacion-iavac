const express = require('express');
const router = express.Router();

// GET /api/destinos — Listar todas las salidas pedagógicas (con cupos disponibles)
router.get('/', (req, res) => {
  try {
    const destinos = req.db.prepare(`
      SELECT d.*,
        d.cupos - COALESCE(
          (SELECT SUM(r.num_personas) FROM reservas r WHERE r.destino_id = d.id AND r.estado = 'confirmada'), 0
        ) as cupos_disponibles
      FROM destinos d
      ORDER BY fecha_inicio ASC
    `).all();
    res.json({ ok: true, total: destinos.length, data: destinos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/destinos/buscar?q=... — Buscar salidas por nombre o región
router.get('/buscar', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ ok: false, error: 'Parámetro de búsqueda "q" requerido' });
    }
    const destinos = req.db.prepare(`
      SELECT d.*,
        d.cupos - COALESCE(
          (SELECT SUM(r.num_personas) FROM reservas r WHERE r.destino_id = d.id AND r.estado = 'confirmada'), 0
        ) as cupos_disponibles
      FROM destinos d
      WHERE d.nombre LIKE @query OR d.region LIKE @query
      ORDER BY d.precio ASC
    `).all({ query: `%${q}%` });

    res.json({ ok: true, total: destinos.length, data: destinos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/destinos/:id — Obtener una salida por ID (con cupos disponibles y asientos ocupados)
router.get('/:id', (req, res) => {
  try {
    const destino = req.db.prepare(`
      SELECT d.*,
        d.cupos - COALESCE(
          (SELECT SUM(r.num_personas) FROM reservas r WHERE r.destino_id = d.id AND r.estado = 'confirmada'), 0
        ) as cupos_disponibles
      FROM destinos d
      WHERE d.id = ?
    `).get(req.params.id);

    if (!destino) {
      return res.status(404).json({ ok: false, error: 'Salida pedagógica no encontrada' });
    }

    // Obtener los asientos ocupados en reservas confirmadas
    const reservas = req.db.prepare(`
      SELECT asientos FROM reservas 
      WHERE destino_id = ? AND estado = 'confirmada'
    `).all(req.params.id);

    const asientosOcupados = [];
    reservas.forEach(r => {
      if (r.asientos) {
        r.asientos.split(',').forEach(s => {
          const num = parseInt(s.trim(), 10);
          if (!isNaN(num) && !asientosOcupados.includes(num)) {
            asientosOcupados.push(num);
          }
        });
      }
    });

    asientosOcupados.sort((a, b) => a - b);

    res.json({ 
      ok: true, 
      data: { 
        ...destino, 
        asientos_ocupados: asientosOcupados 
      } 
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

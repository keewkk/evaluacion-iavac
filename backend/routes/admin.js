const express = require('express');
const router = express.Router();

// GET /api/admin/dashboard — Estadísticas generales
router.get('/dashboard', (req, res) => {
  try {
    const totalDestinos = req.db.prepare('SELECT COUNT(*) as total FROM destinos').get().total;
    const totalReservas = req.db.prepare('SELECT COUNT(*) as total FROM reservas').get().total;
    const reservasConfirmadas = req.db.prepare("SELECT COUNT(*) as total FROM reservas WHERE estado = 'confirmada'").get().total;
    const reservasCanceladas = req.db.prepare("SELECT COUNT(*) as total FROM reservas WHERE estado = 'cancelada'").get().total;
    const costoTotal = req.db.prepare(`
      SELECT COALESCE(SUM(d.precio * r.num_personas), 0) as total
      FROM reservas r JOIN destinos d ON r.destino_id = d.id
      WHERE r.estado = 'confirmada'
    `).get().total;
    const totalPasajeros = req.db.prepare(`
      SELECT COALESCE(SUM(num_personas), 0) as total FROM reservas WHERE estado = 'confirmada'
    `).get().total;

    res.json({
      ok: true,
      data: {
        totalDestinos,
        totalReservas,
        reservasConfirmadas,
        reservasCanceladas,
        costoTotal,
        totalPasajeros
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/admin/reservas — Todas las inscripciones (vista admin)
router.get('/reservas', (req, res) => {
  try {
    const reservas = req.db.prepare(`
      SELECT r.*, d.nombre as destino_nombre, d.region, d.precio, d.duracion_dias,
             d.fecha_inicio, d.fecha_fin, d.imagen_url
      FROM reservas r
      JOIN destinos d ON r.destino_id = d.id
      ORDER BY r.fecha_reserva DESC
    `).all();

    res.json({ ok: true, total: reservas.length, data: reservas });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET /api/admin/destinos — Todas las salidas con info de inscripciones
router.get('/destinos', (req, res) => {
  try {
    const destinos = req.db.prepare(`
      SELECT d.*,
        COALESCE((SELECT COUNT(*) FROM reservas r WHERE r.destino_id = d.id AND r.estado = 'confirmada'), 0) as total_reservas,
        COALESCE((SELECT SUM(r.num_personas) FROM reservas r WHERE r.destino_id = d.id AND r.estado = 'confirmada'), 0) as pasajeros_confirmados
      FROM destinos d
      ORDER BY total_reservas DESC
    `).all();

    res.json({ ok: true, total: destinos.length, data: destinos });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

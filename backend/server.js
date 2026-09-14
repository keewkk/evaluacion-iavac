const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('../database/init');

// ── Inicializar aplicación ──────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── Inicializar base de datos ───────────────────────────────────
const db = initDatabase();

// ── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Inyectar instancia de BD en cada request
app.use((req, res, next) => {
  req.db = db;
  next();
});

// ── Rutas de la API ─────────────────────────────────────────────
const destinosRouter = require('./routes/destinos');
const reservasRouter = require('./routes/reservas');
const adminRouter = require('./routes/admin');

app.use('/api/destinos', destinosRouter);
app.use('/api/reservas', reservasRouter);
app.use('/api/admin', adminRouter);

// ── Ruta catch-all para SPA ─────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ── Manejo de errores global ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

// ── Iniciar servidor ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   🌿 SalidasUNAB - Servidor iniciado        ║
  ║   📍 http://localhost:${PORT}                  ║
  ║   🏫 Universidad Andrés Bello               ║
  ║   🔬 Ecoturismo & Biología Marina           ║
  ╚══════════════════════════════════════════════╝
  `);
});

// ── Cerrar BD al terminar ───────────────────────────────────────
process.on('SIGINT', () => {
  db.close();
  console.log('\n🔒 Base de datos cerrada. ¡Hasta pronto!');
  process.exit(0);
});

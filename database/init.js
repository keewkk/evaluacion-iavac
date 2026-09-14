const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'viajes.db');

function initDatabase() {
  const db = new Database(DB_PATH);

  // Habilitar WAL mode para mejor rendimiento
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ── Crear tablas ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS destinos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      region TEXT NOT NULL,
      descripcion TEXT,
      imagen_url TEXT,
      precio REAL NOT NULL,
      duracion_dias INTEGER,
      fecha_inicio TEXT,
      fecha_fin TEXT,
      cupos INTEGER DEFAULT 20,
      creado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destino_id INTEGER NOT NULL,
      nombre_pasajero TEXT NOT NULL,
      email TEXT NOT NULL,
      telefono TEXT,
      num_personas INTEGER DEFAULT 1,
      asientos TEXT,
      fecha_reserva TEXT DEFAULT (datetime('now')),
      estado TEXT DEFAULT 'confirmada',
      notas TEXT,
      FOREIGN KEY (destino_id) REFERENCES destinos(id)
    );
  `);

  // Asegurar que la columna asientos exista si la tabla ya fue creada
  try {
    const tableInfo = db.prepare("PRAGMA table_info(reservas)").all();
    const hasAsientos = tableInfo.some(col => col.name === 'asientos');
    if (!hasAsientos) {
      db.exec("ALTER TABLE reservas ADD COLUMN asientos TEXT;");
    }
  } catch (err) {
    console.error('Verificación de columna asientos:', err.message);
  }

  // ── Insertar datos semilla (solo si la tabla está vacía) ──────
  const count = db.prepare('SELECT COUNT(*) as total FROM destinos').get();

  if (count.total === 0) {
    const insert = db.prepare(`
      INSERT INTO destinos (nombre, region, descripcion, imagen_url, precio, duracion_dias, fecha_inicio, fecha_fin, cupos)
      VALUES (@nombre, @region, @descripcion, @imagen_url, @precio, @duracion_dias, @fecha_inicio, @fecha_fin, @cupos)
    `);

    const destinos = [
      {
        nombre: 'Parque Nacional La Campana',
        region: 'Región de Valparaíso',
        descripcion: 'Salida pedagógica al Parque Nacional La Campana para el estudio de la flora esclerófila nativa y el bosque de palma chilena. Incluye trekking al Cerro La Campana con observación de ecosistemas mediterráneos y registro de especies endémicas.',
        imagen_url: 'https://picsum.photos/seed/la-campana-park/600/400',
        precio: 45000,
        duracion_dias: 2,
        fecha_inicio: '2026-10-15',
        fecha_fin: '2026-10-16',
        cupos: 20
      },
      {
        nombre: 'CIMARQ Quintay — Investigación Marina',
        region: 'Región de Valparaíso',
        descripcion: 'Visita a la Estación de Investigaciones Marinas de Quintay (CIMARQ). Actividades de buceo científico, muestreo de organismos marinos, análisis en laboratorio de biología marina y recorrido por las instalaciones de cultivo de abalón.',
        imagen_url: 'https://picsum.photos/seed/cimarq-quintay/600/400',
        precio: 65000,
        duracion_dias: 2,
        fecha_inicio: '2026-10-22',
        fecha_fin: '2026-10-23',
        cupos: 20
      },
      {
        nombre: 'Reserva Nacional Lago Peñuelas',
        region: 'Región de Valparaíso',
        descripcion: 'Salida de avistamiento de aves y estudio de ecosistemas lacustres en la Reserva Nacional Lago Peñuelas. Identificación de avifauna local, monitoreo de calidad de agua y análisis de biodiversidad en humedales.',
        imagen_url: 'https://picsum.photos/seed/lago-penuelas/600/400',
        precio: 35000,
        duracion_dias: 1,
        fecha_inicio: '2026-11-05',
        fecha_fin: '2026-11-05',
        cupos: 20
      },
      {
        nombre: 'Zona Cordillerana Portillo',
        region: 'Región de Valparaíso',
        descripcion: 'Expedición a la zona cordillerana de Portillo para el estudio de ecosistemas de alta montaña. Observación de flora y fauna altoandina, geomorfología glaciar y adaptaciones biológicas a condiciones extremas.',
        imagen_url: 'https://picsum.photos/seed/portillo-mountain/600/400',
        precio: 55000,
        duracion_dias: 2,
        fecha_inicio: '2026-11-20',
        fecha_fin: '2026-11-21',
        cupos: 20
      },
      {
        nombre: 'Parque Nacional Bosque Fray Jorge',
        region: 'Región de Coquimbo',
        descripcion: 'Visita al bosque relicto de niebla de Fray Jorge, declarado Reserva de la Biósfera por UNESCO. Estudio de la influencia de la camanchaca en la vegetación valdiviana en zona semiárida y análisis de microclimas.',
        imagen_url: 'https://picsum.photos/seed/fray-jorge/600/400',
        precio: 75000,
        duracion_dias: 3,
        fecha_inicio: '2026-12-01',
        fecha_fin: '2026-12-03',
        cupos: 20
      },
      {
        nombre: 'Reserva Nacional Pingüino de Humboldt',
        region: 'Región de Coquimbo',
        descripcion: 'Salida de campo a la Reserva Nacional Pingüino de Humboldt. Observación de colonias de pingüinos, lobos marinos y delfines nariz de botella. Estudio de corrientes marinas y su impacto en la biodiversidad costera.',
        imagen_url: 'https://picsum.photos/seed/pinguino-humboldt/600/400',
        precio: 80000,
        duracion_dias: 3,
        fecha_inicio: '2027-03-10',
        fecha_fin: '2027-03-12',
        cupos: 20
      },
      {
        nombre: 'Parque Nacional Conguillío',
        region: 'Región de La Araucanía',
        descripcion: 'Expedición al Parque Nacional Conguillío para estudio de vulcanología y bosques de araucaria. Análisis de sucesión ecológica post-erupción del volcán Llaima, identificación de flora nativa y fauna endémica.',
        imagen_url: 'https://picsum.photos/seed/conguillio-park/600/400',
        precio: 95000,
        duracion_dias: 3,
        fecha_inicio: '2027-04-05',
        fecha_fin: '2027-04-07',
        cupos: 20
      },
      {
        nombre: 'Humedal de Mantagua',
        region: 'Región de Valparaíso',
        descripcion: 'Salida al Humedal de Mantagua para el estudio de ecosistemas costeros y su biodiversidad. Muestreo de invertebrados, identificación de plantas halófitas y análisis del impacto antrópico en humedales costeros.',
        imagen_url: 'https://picsum.photos/seed/humedal-mantagua/600/400',
        precio: 30000,
        duracion_dias: 1,
        fecha_inicio: '2026-10-08',
        fecha_fin: '2026-10-08',
        cupos: 20
      }
    ];

    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insert.run(item);
      }
    });

    insertMany(destinos);
    console.log('✅ Base de datos inicializada con', destinos.length, 'salidas pedagógicas (vans de 20 asientos)');
  } else {
    // Asegurar que los cupos sean 20 para todas las salidas
    db.prepare('UPDATE destinos SET cupos = 20 WHERE cupos != 20').run();
    console.log('📦 Base de datos ya contiene', count.total, 'salidas pedagógicas (cupos verificados a 20)');
  }

  return db;
}

module.exports = { initDatabase, DB_PATH };

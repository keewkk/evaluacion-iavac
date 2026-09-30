-- Se ejecuta automaticamente al crear el contenedor de MySQL
-- (montado en /docker-entrypoint-initdb.d, ver docker-compose.yml)
-- Modulo R1 - Instrumentos y carga documental (Evaluacion IA VAC)

CREATE TABLE IF NOT EXISTS instrumentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    estado ENUM('BORRADOR', 'PUBLICADO') NOT NULL DEFAULT 'BORRADOR',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS criterios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instrumento_id INT NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    puntaje_max INT NOT NULL DEFAULT 5,
    FOREIGN KEY (instrumento_id) REFERENCES instrumentos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    tipo VARCHAR(100),
    ruta_archivo VARCHAR(500) NOT NULL,
    instrumento_id INT NULL,
    estado ENUM('CARGADO', 'ASOCIADO') NOT NULL DEFAULT 'CARGADO',
    cargado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instrumento_id) REFERENCES instrumentos(id) ON DELETE SET NULL
);

-- Modulo R2 - Preevaluacion asistida por IA (Qwen / Gemma)
-- R1 deja instrumentos + documentos listos; esta tabla guarda cada intento
-- de preevaluacion (incluso los que fallan porque aun no llegan las API keys).

CREATE TABLE IF NOT EXISTS preevaluaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento_id INT NOT NULL,
    instrumento_id INT NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    estado ENUM('PENDIENTE', 'COMPLETADA', 'ERROR') NOT NULL DEFAULT 'PENDIENTE',
    resultado JSON NULL,
    error TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    FOREIGN KEY (instrumento_id) REFERENCES instrumentos(id) ON DELETE CASCADE
);

-- Modulo M3 - Trazabilidad (log de auditoria)
-- Registro inmutable de cada cambio relevante sobre instrumentos/documentos.

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entidad VARCHAR(50) NOT NULL,
    entidad_id INT NULL,
    accion ENUM('CREAR', 'ACTUALIZAR', 'ELIMINAR', 'CARGAR', 'ASOCIAR', 'PREEVALUAR') NOT NULL,
    detalle TEXT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

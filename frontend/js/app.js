// ══════════════════════════════════════════════════════════════
// SalidasUNAB — Lógica compartida (Navbar, Footer, Utilidades)
// ══════════════════════════════════════════════════════════════

const API_BASE = '/api';

// ── Formatear precio en CLP ─────────────────────────────────
function formatPrecio(precio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(precio);
}

// ── Formatear fecha ─────────────────────────────────────────
function formatFecha(fechaStr) {
  if (!fechaStr) return 'Por definir';
  const fecha = new Date(fechaStr + 'T00:00:00');
  return fecha.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// ── Mostrar alerta ──────────────────────────────────────────
function mostrarAlerta(elementId, tipo, mensaje) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `alerta alerta-${tipo} visible`;
  el.textContent = mensaje;
  if (tipo === 'exito') {
    setTimeout(() => el.classList.remove('visible'), 5000);
  }
}

// ── Peticiones API ──────────────────────────────────────────
async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  return res.json();
}

async function apiPost(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function apiDelete(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
  return res.json();
}

// ── Toggle menú móvil ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    // Cerrar menú al hacer click en un enlace
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
      });
    });
  }

  // Marcar enlace activo
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href').replace('./', '').replace('/', '');
    const linkPage = href || 'index.html';
    if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
      link.classList.add('active');
    }
  });
});

// ── Manejar error de imagen ────────────────────────────────
function handleImgError(img) {
  img.onerror = null;
  img.style.background = 'linear-gradient(135deg, #003366, #0066cc)';
  img.style.display = 'flex';
  img.src = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
    '<rect fill="#003366" width="600" height="400"/>' +
    '<text x="300" y="200" text-anchor="middle" fill="white" font-size="40">🌿</text>' +
    '</svg>'
  );
}

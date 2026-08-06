/**
 * ==========================================================================
 * NEON PULSE BAR - SCRIPT DIGITAL MENU
 * Configurable Google Sheets CSV Fetcher & Vanilla JS Dynamic Renderer
 * ==========================================================================
 */

// 1. URL de la hoja de cálculo de Google publicada como CSV
// Reemplaza 'TU_ID_DE_HOJA' con el ID real de tu Google Sheet pública.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/TU_ID_DE_HOJA/export?format=csv';

// Datos de demostración de respaldo (fallback) por si el ID de hoja no ha sido configurado o falla el fetch
const DEMO_MENU_DATA = [
  {
    titulo: 'Viche en Botella 750ml',
    descripcion: 'Botella de viche artesanal de 750 ml.',
    precio: '70000',
    categoria: 'Espirituales'
  },
  {
    titulo: 'Aguardiente Amarillo',
    descripcion: 'Aguardiente colombiano de anís.',
    precio: '70000',
    categoria: 'Espirituales'
  },
  {
    titulo: 'Shot de Viche',
    descripcion: 'Porción de viche servida en shot.',
    precio: '7000',
    categoria: 'Espirituales'
  },
  {
    titulo: 'Águila',
    descripcion: 'Cerveza lager colombiana.',
    precio: '7000',
    categoria: 'Cervezas'
  },
  {
    titulo: 'Poker',
    descripcion: 'Cerveza lager colombiana.',
    precio: '7000',
    categoria: 'Cervezas'
  },
  {
    titulo: 'Club Colombia',
    descripcion: 'Cerveza premium colombiana.',
    precio: '8000',
    categoria: 'Cervezas'
  },
  {
    titulo: 'Agua Natural',
    descripcion: 'Agua purificada.',
    precio: '3100',
    categoria: 'Sin Alcohol'
  },
  {
    titulo: 'Agua con Gas',
    descripcion: 'Agua carbonatada.',
    precio: '3100',
    categoria: 'Sin Alcohol'
  },
  {
    titulo: 'Gatorade',
    descripcion: 'Bebida isotónica.',
    precio: '3100',
    categoria: 'Sin Alcohol'
  },
  {
    titulo: 'Soda',
    descripcion: 'Agua carbonatada para mezclar bebidas.',
    precio: '3100',
    categoria: 'Sin Alcohol'
  },
  {
    titulo: 'Cigarrillos',
    descripcion: 'Cajetilla de cigarrillos.',
    precio: '4100',
    categoria: 'Confitería'
  },
  {
    titulo: 'Bonbonbum',
    descripcion: 'Caramelo duro con chicle.',
    precio: '4100',
    categoria: 'Confitería'
  }
];

// Estado global de la aplicación
let allProducts = [];
let currentCategory = 'Todos';

/**
 * 2. Parseador sencillo de CSV a Array de Objetos JSON en Vanilla JS
 * Soporta valores entre comillas y saltos de línea dentro de campos.
 */
function parseCSV(csvText) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Saltar comilla escapada
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Saltar \r\n
      }
      currentLine.push(currentField.trim());
      if (currentLine.some(field => field.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some(field => field.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) return [];

  // Normalizar encabezados (quitar comillas, espacios adicionales y pasar a minúsculas)
  const headers = lines[0].map(h => 
    h.toLowerCase()
     .normalize("NFD")
     .replace(/[\u0300-\u036f]/g, "") // Quitar acentos para mayor compatibilidad
     .replace(/[^a-z0-9]/g, "")
  );

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < headers.length && row.join('').trim() === '') continue;

    const obj = {};
    headers.forEach((header, index) => {
      let value = row[index] || '';
      // Limpiar comillas iniciales/finales sobrantes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      obj[header] = value.trim();
    });

    // Mapear campos esperados
    const item = {
      titulo: obj.titulo || obj.title || obj.nombre || 'Producto sin nombre',
      descripcion: obj.descripcion || obj.description || obj.detalle || '',
      precio: obj.precio || obj.price || '0',
      categoria: obj.categoria || obj.category || 'General'
    };

    if (item.titulo && item.titulo !== 'Producto sin nombre') {
      results.push(item);
    }
  }

  return results;
}

/**
 * Formateador de precios en moneda local
 */
function formatPrice(val) {
  if (!val) return '$ 0';
  // Extraer únicamente caracteres numéricos y punto/coma
  let cleaned = String(val).replace(/[^0-9.,]/g, '');
  
  // Si contiene coma como decimal, convertir a punto
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return `$ ${val}`;

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Obtener ícono Lucide sugerido según categoría o nombre
 */
function getCategoryIcon(categoria, titulo) {
  const cat = (categoria || '').toLowerCase();
  const tit = (titulo || '').toLowerCase();

  if (cat.includes('cóctel') || cat.includes('coctel') || tit.includes('gin') || tit.includes('sour')) {
    return 'glass-water';
  }
  if (cat.includes('cerveza') || tit.includes('ipa') || tit.includes('lager')) {
    return 'beer';
  }
  if (cat.includes('hamburguesa') || cat.includes('tapa') || tit.includes('burger') || tit.includes('taco')) {
    return 'utensils-crossed';
  }
  if (cat.includes('confitería') || tit.includes('volcán') || tit.includes('helado')) {
    return 'ice-cream';
  }
  if (cat.includes('sin alcohol') || cat.includes('bebida')) {
    return 'cup-soda';
  }
  return 'sparkles';
}

/**
 * Renderizar Skeleton Loader durante el estado de carga (Estilo Bento Grid)
 */
function renderSkeletonLoading() {
  const grid = document.getElementById('products-grid');
  const statusContainer = document.getElementById('menu-status');
  statusContainer.innerHTML = '';
  grid.innerHTML = '';

  // Big Bento Skeleton
  grid.innerHTML += `
    <div class="col-span-1 md:col-span-2 row-span-1 md:row-span-2 bento-card p-6 sm:p-8 flex flex-col justify-between h-72 md:h-auto min-h-[280px]">
      <div>
        <div class="skeleton h-5 w-32 rounded-sm mb-6"></div>
        <div class="skeleton h-8 w-3/4 rounded-sm mb-4"></div>
        <div class="skeleton h-4 w-full rounded-sm mb-2"></div>
        <div class="skeleton h-4 w-5/6 rounded-sm"></div>
      </div>
      <div class="flex justify-between items-center border-t border-zinc-800 pt-4">
        <div class="skeleton h-7 w-28 rounded-sm"></div>
        <div class="skeleton h-4 w-16 rounded-sm"></div>
      </div>
    </div>
  `;

  // Standard Bento Skeletons
  for (let i = 0; i < 5; i++) {
    grid.innerHTML += `
      <div class="bento-card p-5 sm:p-6 flex flex-col justify-between min-h-[200px]">
        <div>
          <div class="skeleton h-4 w-20 rounded-sm mb-3"></div>
          <div class="skeleton h-6 w-5/6 rounded-sm mb-3"></div>
          <div class="skeleton h-3.5 w-full rounded-sm mb-1"></div>
          <div class="skeleton h-3.5 w-4/5 rounded-sm"></div>
        </div>
        <div class="skeleton h-6 w-24 rounded-sm mt-4 pt-2"></div>
      </div>
    `;
  }
}

/**
 * Renderizar Mensaje de Error con opción de Reintento y Demostración
 */
function renderError(message, isConfigPlaceholder = false) {
  const grid = document.getElementById('products-grid');
  const statusContainer = document.getElementById('menu-status');
  grid.innerHTML = '';

  const subtitleText = isConfigPlaceholder 
    ? 'Para conectar tu propia carta, reemplaza la constante <code>SHEET_URL</code> en <code>script.js</code> con el enlace de tu Google Sheet exportado a CSV.'
    : 'Verifica la conexión a internet o el enlace exportado a CSV en tu Google Sheet.';

  statusContainer.innerHTML = `
    <div class="max-w-xl mx-auto my-8 p-6 bento-card neon-border-active bg-zinc-900/90 text-center shadow-[0_0_30px_rgba(188,19,254,0.15)] animate-fade-in font-mono">
      <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center text-purple-400">
        <i data-lucide="${isConfigPlaceholder ? 'info' : 'alert-triangle'}" class="w-6 h-6"></i>
      </div>
      <h3 class="text-xl font-bold text-white mb-2 tracking-tight uppercase">${isConfigPlaceholder ? 'Conexión a Google Sheets Lista' : 'Error de Sincronización'}</h3>
      <p class="text-zinc-300 text-xs mb-3 leading-relaxed">${message}</p>
      <p class="text-zinc-500 text-[11px] mb-6">${subtitleText}</p>
      
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button onclick="fetchMenuData()" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(188,19,254,0.4)] flex items-center gap-2">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          <span>Reintentar Conexión</span>
        </button>
        <button onclick="loadDemoMenu()" class="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2">
          <i data-lucide="zap" class="w-4 h-4 text-purple-400"></i>
          <span>Cargar Carta Demo</span>
        </button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

/**
 * Renderizar Tabs de Categorías (Estilo Bento / Industrial)
 */
function renderCategories(products) {
  const nav = document.getElementById('categories-container');
  if (!nav) return;

  const categories = ['Todos', ...new Set(products.map(p => p.categoria).filter(Boolean))];

  nav.innerHTML = categories.map(cat => {
    const count = cat === 'Todos' ? products.length : products.filter(p => p.categoria === cat).length;
    return `
      <button 
        onclick="filterCategory('${cat.replace(/'/g, "\\'")}')" 
        class="category-btn px-5 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${cat === currentCategory ? 'active' : ''}"
      >
        <span>${cat}</span>
        <span class="text-[10px] font-mono opacity-80">(${count})</span>
      </button>
    `;
  }).join('');
}

/**
 * Filtrar por Categoría
 */
function filterCategory(cat) {
  currentCategory = cat;
  renderCategories(allProducts);
  renderProducts();
}

/**
 * Renderizar Tarjetas de Productos en Bento Grid Layout
 */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const statusContainer = document.getElementById('menu-status');
  statusContainer.innerHTML = '';

  const filtered = currentCategory === 'Todos' 
    ? allProducts 
    : allProducts.filter(p => p.categoria === currentCategory);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    statusContainer.innerHTML = `
      <div class="text-center py-16 text-zinc-500 font-mono">
        <i data-lucide="slash" class="w-10 h-10 mx-auto mb-3 text-zinc-700"></i>
        <p class="text-sm font-bold uppercase tracking-wider">No hay productos en "${currentCategory}"</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = filtered.map((item, idx) => {
    const iconName = getCategoryIcon(item.categoria, item.titulo);
    const formattedPrice = formatPrice(item.precio);

    // Si es el primer elemento de la lista y estamos en "Todos" o hay más de 3 elementos, renderizar como Bento Card principal destacada
    const isFeatured = idx === 0 && filtered.length > 2;

    if (isFeatured) {
      return `
        <article class="col-span-1 md:col-span-2 row-span-1 md:row-span-2 bento-card neon-border-active bg-zinc-900/80 p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden group transition-all duration-300 animate-fade-in">
          <div class="absolute top-0 right-0 px-3 py-1 bg-purple-600 text-white text-[10px] font-mono font-bold uppercase tracking-widest">
            Especial de la Casa
          </div>
          <div>
            <div class="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider mb-4">
              <i data-lucide="${iconName}" class="w-4 h-4"></i>
              <span>${item.categoria || 'Destacado'}</span>
            </div>
            <h3 class="text-2xl sm:text-4xl font-bold text-white mb-3 tracking-tight group-hover:text-purple-300 transition-colors">
              ${item.titulo}
            </h3>
            <p class="text-zinc-400 text-sm sm:text-base leading-relaxed mb-6 max-w-md font-light">
              ${item.descripcion || 'Sin descripción disponible.'}
            </p>
          </div>

          <div class="flex items-center justify-between border-t border-zinc-800/80 pt-4">
            <span class="price-tag text-2xl sm:text-3xl font-mono">${formattedPrice}</span>
            <span class="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1">
              <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              Disponible
            </span>
          </div>
        </article>
      `;
    }

    return `
      <article class="bento-card neon-border bg-zinc-900/60 p-5 sm:p-6 flex flex-col justify-between hover:neon-border-active transition-all duration-300 animate-fade-in group" style="animation-delay: ${idx * 0.04}s">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] font-mono font-bold uppercase text-purple-400/90 tracking-wider flex items-center gap-1.5">
              <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
              ${item.categoria || 'Especial'}
            </span>
          </div>

          <h3 class="text-base sm:text-lg font-bold text-zinc-100 mb-2 tracking-tight group-hover:text-purple-300 transition-colors">
            ${item.titulo}
          </h3>

          <p class="text-xs text-zinc-400 leading-relaxed mb-4 line-clamp-3 font-light">
            ${item.descripcion || 'Sin descripción disponible.'}
          </p>
        </div>

        <div class="price-tag text-lg font-mono font-bold mt-auto pt-3 border-t border-zinc-800/60 flex items-center justify-between">
          <span>${formattedPrice}</span>
          <i data-lucide="coins" class="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition-colors"></i>
        </div>
      </article>
    `;
  }).join('');

  // Re-inicializar iconos Lucide generados dinámicamente
  lucide.createIcons();
}

/**
 * Cargar datos de demostración
 */
function loadDemoMenu() {
  allProducts = DEMO_MENU_DATA;
  currentCategory = 'Todos';
  renderCategories(allProducts);
  renderProducts();
}

/**
 * 3. Conexión Principal vía fetch a Google Sheets CSV
 */
async function fetchMenuData() {
  renderSkeletonLoading();

  // Comprobar si la URL aún contiene la plantilla sin reemplazar
  if (SHEET_URL.includes('TU_ID_DE_HOJA')) {
    setTimeout(() => {
      // Si la URL es la plantilla por defecto, mostrar notificación clara y cargar datos de demo
      renderError('Aún no has configurado el ID de tu Google Sheet en la constante <code>SHEET_URL</code>.', true);
      // Cargar los datos de demo para que el usuario pueda visualizar la SPA inmediatamente
      allProducts = DEMO_MENU_DATA;
      renderCategories(allProducts);
      renderProducts();
    }, 600);
    return;
  }

  try {
    const response = await fetch(SHEET_URL, { cache: 'no-cache' });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const parsedData = parseCSV(csvText);

    if (!parsedData || parsedData.length === 0) {
      throw new Error('La hoja de cálculo está vacía o no tiene el formato de columnas esperado (titulo, descripcion, precio, categoria).');
    }

    allProducts = parsedData;
    currentCategory = 'Todos';
    renderCategories(allProducts);
    renderProducts();

  } catch (error) {
    console.error('Error al obtener datos desde Google Sheets:', error);
    renderError(`No se pudieron sincronizar los productos desde Google Sheets: ${error.message}`);
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  fetchMenuData();
});

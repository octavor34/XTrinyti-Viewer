// --- GLOBAL ERROR CATCHER ---
window.onerror = function(msg, url, line) {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        consoleDiv.style.display = 'block';
        consoleDiv.innerText += `ERR: ${msg} @ L${line}\n`;
    }
};

// --- ESTADO GLOBAL ---
let modoActual = 'r34';
let paginaActual = 0;
let redditAfter = '';
let cargando = false;
let hayMas = true;
let misTags = [];
let catalogCache = [];
let boardActual = '';
let subActual = '';
let timerDebounce;
let tagSeleccionadoTemp = '';
let chanCursor = 0;
let isInThread = false;
let scrollCatalogPos = 0;

// --- UI HELPERS ---
function toggleMenu() {
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    
    // Si está oculto o vacío, lo mostramos
    if (p.style.display === 'none' || p.style.display === '') {
        p.style.display = 'block';
        b.style.display = 'block'; // Mostramos el telón
        
        // Auto-focus si es R34
        if (modoActual === 'r34') {
            const input = document.getElementById('input-tags-real');
            if(input) input.focus();
        }
    } else {
        // Si está visible, lo ocultamos
        p.style.display = 'none';
        b.style.display = 'none'; // Ocultamos el telón
    }
}

// Oculta panel de configuración y telón (uso centralizado)
function ocultarPanel(){
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    if(p) p.style.display = 'none';
    if(b) b.style.display = 'none';
}

function cambiarModo() {
    const val = document.getElementById('source-selector').value;
    document.querySelectorAll('.input-group').forEach(el => el.style.display = 'none');
    
    const title = document.getElementById('app-title');
    
    if(val === 'r34') {
        modoActual = 'r34';
        document.getElementById('r34-inputs').style.display = 'block';
        document.documentElement.style.setProperty('--accent', '#3b82f6');
        title.innerText = "RULE34 VIEWER";
    } else if(val === '4chan') {
        modoActual = 'chan_catalog';
        document.getElementById('chan-inputs').style.display = 'block';
        document.documentElement.style.setProperty('--accent', '#009688');
        title.innerText = "4CHAN BROWSER";
    } else if(val === 'reddit') {
        modoActual = 'reddit';
        document.getElementById('reddit-inputs').style.display = 'block';
        document.documentElement.style.setProperty('--accent', '#ff4500');
        title.innerText = "REDDIT FEED";
    } else if(val === 'x') {
        modoActual = 'x';
        document.getElementById('x-inputs').style.display = 'block';
        document.documentElement.style.setProperty('--accent', '#ffffff');
        title.innerText = "X (TWITTER)";
    }
}

function checkRedditInput() {
    const sel = document.getElementById('reddit-selector').value;
    const input = document.getElementById('reddit-custom');
    input.style.display = (sel === 'custom') ? 'block' : 'none';
}

function detectType(url) {
    if (!url) return "img";

    const lower = url.toLowerCase();

    // 1. Detectar Twitter/Reddit con format=jpg|png|gif
    const fmtMatch = lower.match(/format=(\w+)/);
    if (fmtMatch) {
        const fmt = fmtMatch[1];
        if (["jpg", "jpeg", "png", "webp"].includes(fmt)) return "img";
        if (fmt === "gif") return "gif";
        if (["mp4", "mov", "webm"].includes(fmt)) return "vid";
    }

    // 2. v.redd.it siempre es video
    if (lower.includes("v.redd.it")) return "vid";

    // 3. RedGifs detección
    if (lower.includes("redgifs.com") || lower.includes("gifdeliverynetwork")) return "vid";

    // 4. Webp sin extensión
    if (lower.includes("webp")) return "img";

    // 5. Detectar por extensión clásica
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();

    if (["mp4", "webm", "m4v", "mov"].includes(ext)) return "vid";
    if (ext === "gif") return "gif";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "img";

    // 6. Fallback: si la URL incluye cosas de imagen
    if (lower.includes("preview") || lower.includes("image") || lower.includes("media")) {
        return "img";
    }

    // 7. Último recurso: imagen
    return "img";
}

// --- NETWORK ENGINE ---
// Requiere que PROXIES esté definido en drivers.js
async function fetchSmart(targetUrl) {
    let inicio = 0;

   // Reddit SIEMPRE directo (inicio en 1)
   if (targetUrl.includes('nitter') || targetUrl.includes("reddit.com") || targetUrl.includes("i.reddit.com")) {
    inicio = 1;
    }

    // --- CORRECCIÓN CENTRALIZADA PARA 4CHAN ---
    let urlToUse = targetUrl;
    // Si es una URL de 4chan, la envolvemos con un proxy específico
    if (targetUrl.includes('4cdn.org')) {
        urlToUse = "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl);
        inicio = 0; // Forzamos usar el proxy directo (índice 0) que ahora es el proxy de codetabs
    }

    for (let i = inicio; i < PROXIES.length; i++) {
        const proxy = PROXIES[i];
        let finalUrl;

        // Caso directo
        if (proxy.type === 'direct') {
            finalUrl = targetUrl;
        }
        // Proxies tipo corsproxy.io/?URL
        else if (proxy.url.includes('?')) {
            finalUrl = proxy.url + targetUrl;
        }
        // Proxies que requieren URL codificada
        else {
            finalUrl = proxy.url + encodeURIComponent(targetUrl);
        }

        try {
            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error("HTTP " + res.status);

            const txt = await res.text();
            if (!txt) throw new Error("Vacío");

            if (txt.trim().startsWith('<')) return txt;
            return JSON.parse(txt);
        } catch (e) { }
    }

    throw new Error("Error de Conexión (Todos los proxies fallaron)");
}

function ejecutarBusqueda() {
    // 1. Ocultar interfaz (Menú y Telón)
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    
    // 2. Resetear Feed
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('centinela-scroll').style.display = 'none';
    
    // 3. Resetear Variables
    paginaActual = 0; 
    redditAfter = ''; 
    hayMas = true; 
    cargando = false;

    // 4. Ejecutar Driver
    if(modoActual === 'r34') cargarPaginaR34(0);
    else if(modoActual === 'chan_catalog') cargarCatalogo4Chan();
    else if(modoActual === 'reddit') cargarPaginaReddit();
    else if(modoActual === 'x') cargarX();
}

// --- R34 ---
function sanitizeTag(tag) {
    if (!tag) return "";
    return tag
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""); // elimina caracteres inválidos
}
function buscarR34() { ejecutarBusqueda(); }
async function cargarPaginaR34(pageNum) {
    if (cargando) return; cargando = true;
    const tags = misTags.join(' ') || document.getElementById('input-tags-real').value.trim();
    // R34_UID y R34_KEY deben estar en drivers.js
    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=10&pid=${pageNum}&tags=${encodeURIComponent(tags)}&user_id=${R34_UID}&api_key=${R34_KEY}`;
    try {
        const data = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        if(!Array.isArray(data) || data.length===0) { hayMas=false; document.getElementById('centinela-scroll').innerText="Fin."; return; }
        data.forEach(renderTarjetaR34);
        paginaActual = pageNum;
        document.getElementById('centinela-scroll').innerText="...";
    } catch(e) { document.getElementById('loading-status').innerText = e.message; } finally { cargando=false; }
}
function renderTarjetaR34(item) {
    const src = item.file_url; let prev = item.sample_url || item.preview_url || src; const type = detectType(src);
    if(type==='gif' && prev.includes('.gif')) prev = item.preview_url || prev;
    renderCard(src, prev, type, item.tags, '', 'r34');
}

// --- REDDIT ---
function buscarReddit() { ejecutarBusqueda(); }
async function cargarPaginaReddit() {
    if (cargando) return; cargando = true;
    let sub = document.getElementById('reddit-selector').value;
    if(sub==='custom') sub = document.getElementById('reddit-custom').value.trim();
    sub = sub.replace(/^(r\/|\/r\/|\/)/i, '');
    let url = `https://i.reddit.com/r/${sub}/hot.json?limit=20`;
    if(redditAfter) url += `&after=${redditAfter}`;
    try {
        const data = await fetchSmart(url);  
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        const posts = data.data.children;
        if(!posts.length) { hayMas=false; document.getElementById('centinela-scroll').innerText="Fin."; return; }
        redditAfter = data.data.after;
        for (let i = 0; i < posts.length; i++) {
            processRedditPost(posts[i].data);
        }        
    } catch(e) { document.getElementById('loading-status').innerText = e.message; } finally { cargando=false; }
}
function processRedditPost(p) {
    if(p.is_self) return;
    if (!p.thumbnail || p.thumbnail === 'self' || p.thumbnail === 'default' || p.thumbnail === 'nsfw') {
        if(!p.preview?.images) return; // ningún preview usable = ignorar
    }    
    let src = p.url; let prev = p.thumbnail; let type = detectType(src);
    // Optimizado: si no hay preview usable, ignorar el post (acelera carga brutalmente)
    if (p.domain.includes('redgifs') || p.domain.includes('v.redd.it')) {
        const vid = p.preview?.reddit_video_preview?.fallback_url 
                || p.secure_media?.reddit_video?.fallback_url;
        
        if (!vid) return; // ignora posts pesados sin preview rápido

        src = vid;
        type = 'vid';
    }
    if((prev==='default'||prev==='nsfw') && p.preview?.images) prev = p.preview.images[0].source.url.replace(/&amp;/g,'&');
    if(type==='img' && !src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
    renderCard(src, prev, type, p.title, `u/${p.author}`, 'reddit');
}

// --- 4CHAN ---

async function cargarCatalogo4Chan() {
    modoActual = 'chan_catalog';
    boardActual = document.getElementById('board-selector').value;
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none'; 
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('loading-status').innerText = `Cargando /${boardActual}/...`;
    document.getElementById('centinela-scroll').style.display = 'none'; 

    const originalUrl = `https://a.4cdn.org/${boardActual}/catalog.json`;
    try {
        const pages = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        catalogCache = [];
        pages.forEach(p => { if(p.threads) catalogCache.push(...p.threads); });
        renderCatalogoOrdenado(); // Llama a la renderización y ordenamiento
    } catch (e) { 
        document.getElementById('loading-status').innerText = "Error 4Chan: " + e.message; 
    }
}

function renderCatalogoOrdenado() {
    if (modoActual !== 'chan_catalog') return;

    const sortEl = document.getElementById('chan-sort');
    if (!sortEl) return;

    document.getElementById('feed-infinito').innerHTML = '';

    const sortMode = sortEl.value;
    let threads = [...catalogCache];

    if (sortMode === 'bump') {
        threads.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0));
        ocultarPanel();
    } else if (sortMode === 'new') {
        threads.sort((a, b) => b.no - a.no);
        ocultarPanel();
    } else if (sortMode === 'img') {
        threads.sort((a, b) => (b.images || 0) - (a.images || 0));
    }
    ocultarPanel();

    threads.forEach(thread => renderHilo4Chan(thread));
}

function renderHilo4Chan(t) {
    const thumb = `https://i.4cdn.org/${boardActual}/${t.tim}s.jpg`;
    const titleRaw = t.sub || t.com || "Sin descripción";
    const cleanDesc = titleRaw.replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 150);
    const card = document.createElement('div'); card.className = 'tarjeta thread-card';
    card.onclick = () => cargarHiloCompleto(t.no);
    card.innerHTML = `<div class="media-wrapper" style="min-height:150px;"><img class="media-content" src="${thumb}" loading="lazy" style="object-fit:contain;height:200px;"><div class="overlay-btn" style="background:rgba(0,0,0,0.8)">VER HILO</div></div><div class="thread-header"><span class="badge bg-chan">/${boardActual}/</span> <span style="color:#aaa; font-size:0.8rem">#${t.no}</span><div class="thread-title" style="font-size:0.8rem; margin-top:5px; font-weight:normal; color:#ddd">${cleanDesc}</div></div><div class="meta-footer"><span>📷 ${t.images}</span><span>💬 ${t.replies}</span></div>`;
    document.getElementById('feed-infinito').appendChild(card);
}
async function cargarHiloCompleto(threadId) {

// 🔥 GUARDAR POSICIÓN EXACTA (window/page) ANTES DE IR AL HILO
scrollCatalogPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    modoActual = 'chan_thread';
    ocultarPanel();

    // 🔥 AHORA SÍ puedes limpiar el feed
    document.getElementById('feed-infinito').innerHTML = '';

    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('nav-chan').style.display = 'block';
    const originalUrl = `https://a.4cdn.org/${boardActual}/thread/${threadId}.json`;
    try {
        const data = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        let count = 0;
        data.posts.forEach(p => {
            if(p.tim) {
                const src = `https://i.4cdn.org/${boardActual}/${p.tim}${p.ext}`;
                const th = `https://i.4cdn.org/${boardActual}/${p.tim}s.jpg`;
                renderCard(src, th, detectType(src), p.filename+p.ext, '', 'chan');
                count++;
            }
        });
        if(count===0) document.getElementById('loading-status').innerText = "Sin imágenes.";
    } catch(e) { document.getElementById('loading-status').innerText = "Hilo no encontrado."; }
}

// --- X (NITTER) ---
function ejecutarBusquedaX() { ejecutarBusqueda(); }
// --- NITTER MIRRORS (fallback automático) 
const NITTER_MIRRORS = [
    "https://nitter.privacydev.net",
    "https://nitter.zackptg5.com",
    "https://nitter.kavin.rocks",
    "https://nitter.esmailelbob.xyz"
];

async function fetchNitter(query) {
    for (let base of NITTER_MIRRORS) {
        const url = `${base}/search/rss?f=tweets&q=${encodeURIComponent(query)}`;
        try {
            const data = await fetchSmart(url);
            // Si devolvió HTML, es un fallo → probar siguiente mirror
            if (data.trim().startsWith("<html")) continue;
            return { ok: true, xml: data, mirror: base };
        } catch (e) {
            // Probamos siguiente mirror
            continue;
        }
    }
    return { ok: false, error: "Todos los mirrors de Nitter fallaron." };
}
async function cargarX() {
    const q = document.getElementById('x-search').value.trim();

    try {

        // Intentar desde mirrors Nitter
        const out = await fetchNitter(q);

        if (!out.ok) {
            document.getElementById('loading-status').innerText = out.error;
            return;
        }

        const xmlStr = out.xml;
        console.log("Nitter activo:", out.mirror);

        // Caso 1: Nitter devolvió HTML
        if (xmlStr.trim().startsWith('<html')) {
            document.getElementById('loading-status').innerText = "Nitter falló (HTML en vez de XML). Intenta otro servidor.";
            return;
        }
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlStr, "text/xml");
        
        // Caso 2: El parser detectó error
        if (xml.querySelector("parsererror")) {
            document.getElementById('loading-status').innerText = "Error al parsear XML de Nitter.";
            return;
        }
        
        document.getElementById('loading-status').style.display = 'none';
        
        const items = xml.querySelectorAll('item');
        
        // Caso 3: XML válido pero sin tweets
        if (items.length === 0) {
            document.getElementById('loading-status').innerText = "Sin resultados (XML vacío).";
            return;
        }
        if(items.length===0){ document.getElementById('loading-status').innerText="Sin resultados."; return; }
        items.forEach(item => {
            const desc = item.querySelector('description').textContent;
            const img = desc.match(/src="([^"]+)"/);
            if(img) { renderCard(img[1], img[1], 'img', item.querySelector('title').textContent, 'X', 'x'); }
        });
    } catch(e) { document.getElementById('loading-status').innerText = e.message; }
}

// --- RENDER GENERICO ---
function renderCard(src, prev, type, tags, badgeTxt, context) {
    const card = document.createElement('div'); card.className='tarjeta';
    let media='', badge='';
    if(type==='vid') {
        badge=`<span class="badge bg-vid">VID</span>`;
        media=`<div class="media-wrapper"><video class="media-content" controls loop playsinline preload="none" poster="${prev}"><source src="${src}" type="video/mp4"><source src="${src}" type="video/webm"></video><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else if(type==='gif') {
        badge=`<span class="badge bg-gif">GIF</span>`;
        media=`<div class="media-wrapper" onclick="alternarGif(this,'${src}','${prev}')"><img class="media-content" src="${prev}" loading="lazy"><div class="overlay-btn">GIF</div><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else {
        badge=`<span class="badge bg-img">IMG</span>`;
        media=`<div class="media-wrapper"><img class="media-content" src="${prev}" loading="lazy" onclick="abrirLightbox('${src}','img')"><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    }

    if(badgeTxt) badge = `<span class="badge bg-reddit">${badgeTxt}</span>`;
    if(context==='x') badge = `<span class="badge bg-x">X</span>`;
    
    let footer = `<div class="meta-footer">${badge} <span style="font-size:0.7rem;color:#aaa">${tags.substring(0,50)}</span></div>`;
    if(context === 'r34') footer = `<div class="meta-footer"><div style="display:flex;align-items:center">${badge} <span class="btn-expand-tags" onclick="toggleTags(this)">Ver Etiquetas</span></div></div><div class="tags-drawer">${generarTagsHtml(tags)}</div>`;

    card.innerHTML = media + footer;
    if(type==='vid') videoObserver.observe(card.querySelector('video'));
    document.getElementById('feed-infinito').appendChild(card);
}

// --- UTILS ---
function descargar(u) { window.open(u, '_blank'); }
function alternarGif(w,g,p) { const i=w.querySelector('img'); if(w.classList.contains('playing')){i.src=p;w.classList.remove('playing');}else{i.src=g;w.classList.add('playing');} }
function toggleTags(el) { 
    const d = el.closest('.meta-footer').nextElementSibling; 
    if(d.classList.contains('open')){d.classList.remove('open');el.innerText="Ver Etiquetas";}else{d.classList.add('open');el.innerText="Ocultar";} 
}
function generarTagsHtml(t) { return t.split(' ').map(tag=>tag?`<span class="tag-chip" style="font-size:0.7rem;margin:2px" onclick="abrirModal('${tag}')">${tag}</span>`:'').join(''); }

// Restaurar scroll de la página con doble requestAnimationFrame (espera a que el DOM pinte)
function restoreCatalogScroll() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo(0, scrollCatalogPos);
        });
    });
}

function volverCatalogo() {

    modoActual = 'chan_catalog';
    chanCursor = 0;
    isInThread = false;

    ocultarPanel();
    
    document.getElementById('nav-chan').style.display = 'none'; 
    document.getElementById('feed-infinito').innerHTML = '';

    // Si el catálogo ya está en memoria, lo renderizamos SIN recargar
    if (catalogCache && catalogCache.length > 0) {
        renderCatalogoOrdenado();

        // Restaurar scroll DESPUÉS de renderizar
        restoreCatalogScroll();
        return;
    }

    // Si no está en cache, cargarlo y luego restaurar scroll
    cargarCatalogo4Chan().then(() => {
        restoreCatalogScroll();
    });
}

function cargarSiguientePagina() { document.getElementById('centinela-scroll').innerText="Cargando..."; if(modoActual==='r34')cargarPaginaR34(paginaActual+1); if(modoActual==='reddit')cargarPaginaReddit(); }

// Lightbox (mejorado: evita listeners duplicados, corrige orden de transforms, soporte mouse/touch)
const lb = document.getElementById('lightbox');
const lbLayer = document.getElementById('lightbox-transform-layer');

let zoom = { s: 1, x: 0, y: 0 };
let gesturesInitialized = false; // evita duplicar listeners
let lastTapTime = 0; // para double-tap
let pointerActive = false; // para mouse dragging

function abrirLightbox(u, t) {
    lb.style.display = 'flex';
    resetZoom();
    
    if (t === 'vid') {
        // insertar video y detener cualquier comportamiento táctil de imagen (no necesario crear handlers)
        lbLayer.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;max-height:100%"></video>`;
    } else {
        // insertar imagen y (re)usar handlers globales de gestures
        lbLayer.innerHTML = `<img id="lightbox-img" src="${u}" draggable="false">`;
        initGestures(); // idempotente: solo inicializa una vez
    }
}

function cerrarLightbox() {
    // Si hay video, pausarlo explícitamente (por si autoplay sigue)
    const v = lbLayer.querySelector('video');
    if (v && typeof v.pause === 'function') try { v.pause(); } catch (_) {}
    lb.style.display = 'none';
    lbLayer.innerHTML = '';
    resetZoom();
}

function resetZoom() {
    zoom = { s: 1, x: 0, y: 0 };
    updateZoom();
}

function updateZoom() {
    // IMPORTANTE: aplicar translate ANTES que scale para que el panning no se vea afectado por el scale.
    lbLayer.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`;
}

// Inicializa los listeners UNA SOLA VEZ (idempotente)
function initGestures() {
    if (gesturesInitialized) return;
    gesturesInitialized = true;
    
    // Delegación de eventos: manejamos clicks en la imagen dentro del layer
    lbLayer.addEventListener('click', (e) => {
        const img = e.target && e.target.id === 'lightbox-img' ? e.target : null;
        if (!img) return;
        
        const now = Date.now();
        if (now - lastTapTime < 300) {
            // double tap -> toggle zoom
            e.preventDefault();
            toggleZoom();
        }
        lastTapTime = now;
    });
    
    // TOUCH events (para móviles)
    lb.addEventListener('touchstart', startDrag, { passive: false });
    lb.addEventListener('touchmove', drag, { passive: false });
    lb.addEventListener('touchend', endDrag);
    
    // MOUSE events (soporte desktop para arrastrar)
    lb.addEventListener('mousedown', (e) => {
        // solo cuando la imagen está ampliada
        if (zoom.s === 1) return;
        pointerActive = true;
        startDrag(e);
    });
    window.addEventListener('mousemove', (e) => {
        if (!pointerActive) return;
        drag(e);
    });
    window.addEventListener('mouseup', (e) => {
        if (!pointerActive) return;
        pointerActive = false;
        endDrag(e);
    });
}

function toggleZoom() {
    if (zoom.s > 1) {
        resetZoom();
    } else {
        zoom.s = 2.5;
        updateZoom();
    }
}

function startDrag(e) {
    // si el target es un botón del lightbox (close/reset) evitar iniciar panning
    const tgt = e.target || e.srcElement;
    if (tgt && tgt.closest && tgt.closest('.lb-btn')) return;
    
    // si no está zoom, no pans
    if (zoom.s === 1) return;
    
    // prevenir scroll de página en touch
    if (e.type === 'touchstart') e.preventDefault();
    
    zoom.panning = true;
    
    // obtener coordenadas iniciales (soporta touch y mouse)
    const point = (e.touches && e.touches[0]) ? e.touches[0] : e;
    zoom.startX = point.clientX - zoom.x;
    zoom.startY = point.clientY - zoom.y;
    
    // quitar transición para que siga el dedo del usuario
    lbLayer.style.transition = 'none';
}

function drag(e) {
    if (!zoom.panning) return;
    
    // prevenir scroll
    if (e.type === 'touchmove') e.preventDefault();
    
    const point = (e.touches && e.touches[0]) ? e.touches[0] : e;
    zoom.x = point.clientX - zoom.startX;
    zoom.y = point.clientY - zoom.startY;
    
    // opcional: limitar panning para que no se pierda la imagen (simple bounds)
    const maxOffset = 3000; // valor alto para no ser muy restrictivo; ajustar según necesidad
    zoom.x = Math.max(-maxOffset, Math.min(maxOffset, zoom.x));
    zoom.y = Math.max(-maxOffset, Math.min(maxOffset, zoom.y));
    
    updateZoom();
}

function endDrag() {
    zoom.panning = false;
    lbLayer.style.transition = 'transform 0.2s ease-out';
    // si el zoom se reduce por debajo de 1 (caso borde) resetear a 1
    if (zoom.s < 1) {
        resetZoom();
    }
}

// Observers
const videoObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            video.preload = 'metadata';

            // Cuando el video ya cargó metadata, lo desobservamos 100% seguro
            const onLoaded = () => {
                obs.unobserve(video);
                video.removeEventListener('loadedmetadata', onLoaded);
            };

            video.addEventListener('loadedmetadata', onLoaded);
        }
    });
}, { rootMargin: '300px' });
const scrollObserver=new IntersectionObserver((es)=>{if(es[0].isIntersecting && !cargando && hayMas && (modoActual==='r34'||modoActual==='reddit')) cargarSiguientePagina();},{rootMargin:'300px'});
scrollObserver.observe(document.getElementById('centinela-scroll'));

// --- R34 Auto & Chips (FIXED SPACES) ---
const inp = document.getElementById('input-tags-real'); 
const rBox = document.getElementById('sugerencias-box');

inp.addEventListener('input', (e) => {
    const val = inp.value; // No usamos trim() aquí para permitir escribir espacios intermedios
    
    // Si está vacío o es muy corto, ocultamos
    if (val.trim().length < 2) { 
        rBox.style.display = 'none'; 
        return; 
    }

    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(async () => {
        try {
            // TRUCO: Reemplazamos espacios por guiones bajos SOLO para la búsqueda
            // El usuario ve "blue e", pero la API recibe "blue_e"
            const query = val.trim().replace(/ /g, '_');
            
            const d = await fetchSmart(`https://api.rule34.xxx/autocomplete.php?q=${query}`);
            mostrarSugerenciasR34(d);
        } catch (e) {}
    }, 300);
});

function mostrarSugerenciasR34(l) {
    rBox.innerHTML = ''; 
    if (!l || !l.length) { 
        rBox.style.display = 'none'; 
        return; 
    }
    
    l.slice(0, 8).forEach(i => {
        const d = document.createElement('div');
        d.className = 'sugerencia-item';
        
        const v = i.value || i;
        // Limpiar el contador de posts (ej: "(1500)") para que se vea limpio
        const label = i.label || '';
        const count = label.includes('(') ? label.split('(')[1].replace(')', '') : '';
        
        d.innerHTML = `<span>${v}</span><span style="color:#666; font-size:0.8rem">${count}</span>`;
        
        d.onclick = () => {
            agregarTag(v);
            inp.value = '';
            rBox.style.display = 'none';
            inp.focus();
        };
        rBox.appendChild(d);
    });
    rBox.style.display = 'block';
}

inp.addEventListener('keydown', (e) => {
    // Solo creamos el chip al dar ENTER
    if (e.key === 'Enter') { 
        e.preventDefault();
        const textoFinal = inp.value.trim();
        if (textoFinal) {
            // Al dar enter, convertimos los espacios en guiones bajos automáticamente
            // Ej: si el usuario escribió "blue eyes" y dio enter -> "blue_eyes"
            agregarTag(textoFinal.replace(/ /g, '_'));
            inp.value = '';
            rBox.style.display = 'none';
        }
    }
    if (e.key === 'Backspace' && !inp.value) { 
        misTags.pop(); 
        renderChips(); 
    }
});

function agregarTag(t) { 
    if (!misTags.includes(t)) { 
        misTags.push(t); 
        renderChips(); 
    } 
}

function renderChips() {
    const c = document.getElementById('lista-chips'); 
    c.innerHTML = '';
    misTags.forEach((t, i) => {
        const el = document.createElement('div'); 
        el.className = 'tag-chip'; 
        el.innerText = t; 
        el.onclick = () => { 
            misTags.splice(i, 1); 
            renderChips(); 
        }; 
        c.appendChild(el);
    });
}

// --- TAG MODAL (R34) ---
function abrirModal(tag) {
    const modal = document.getElementById('modal-tag-options');
    document.getElementById('modal-tag-name').innerText = tag;
    tagSeleccionadoTemp = tag; // variable global ya existente
    modal.style.display = 'flex';
}

function cerrarModal(e) {
    const modal = document.getElementById('modal-tag-options');
    // Si se hace clic fuera del contenido o en cancelar, cerrar
    if (!e || e.target === modal) {
        modal.style.display = 'none';
    }
}

function accionTag(mode) {
    if (mode === 'add') {
        // Añadir tag al listado actual
        agregarTag(tagSeleccionadoTemp);
        cerrarModal(null);
        return;
    }

    if (mode === 'new') {
        // Buscar SOLO ese tag
        misTags = [tagSeleccionadoTemp];
        renderChips();
        cerrarModal(null);
        buscarR34();
        return;
    }
}

// INIT
window.onload = function() {
    document.getElementById('r34-inputs').style.display = 'block';
};
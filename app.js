// ==========================================
// 1. SISTEMAS BASE (DEBUG & STATE)
// ==========================================

// --- SISTEMA DE DEBUG (FALLBACK) ---
if (typeof window.logDebug === 'undefined') {
    window.logDebug = function() {};
    window.initDebugSystem = function() {};
    window.toggleDebugMode = function() { alert("Módulo debug.js no cargado."); };
    window.clearDebugLog = function() {};
    window.updateDebugButtonUI = function() {};
}

// --- ESTADO GLOBAL ---
let modoActual = 'r34';
let color = '#3b82f6'; // Color por defecto (Azul Rule34)
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
let threadFilterMode = 'all';
let threadViewMode = 'media';
let currentBooru = 'r34';

// ==========================================
// 🔥 (EL VIGILANTE DE VIDEOS) 🔥
// ==========================================
const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // Lógica Práctica:
        // 1. Si el video sale de la pantalla (!isIntersecting), lo PAUSAMOS para no quemar tu CPU.
        // 2. Si el video entra, NO hacemos nada. Esperamos a que tú le des click.
        if (!entry.isIntersecting) {
            entry.target.pause();
        }
    });
}, { threshold: 0.1 }); // Se activa apenas el 10% del video sale/entra
// ==========================================

// NOTA: BOORU_SITES se carga desde drivers.js

// ==========================================
// 2. INTERFAZ DE USUARIO (UI)
// ==========================================

function toggleMenu() {
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    if (p.style.display === 'none' || p.style.display === '') {
        p.style.display = 'block';
        b.style.display = 'block';
        if (modoActual === 'r34') {
            const input = document.getElementById('input-tags-real');
            if (input) input.focus();
        }
    } else {
        p.style.display = 'none';
        b.style.display = 'none';
    }
}

function ocultarPanel() {
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    if (p) p.style.display = 'none';
    if (b) b.style.display = 'none';
}

// --- ADMIN SYSTEM ---
function abrirAdminLogin() {
    const panel = document.getElementById('panel-admin');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }
    document.getElementById('modal-admin-login').style.display = 'flex';
    setTimeout(() => { document.getElementById('admin-pass-input').focus(); }, 100);
}

function checkAdminPass() {
    const input = document.getElementById('admin-pass-input');
    if (input.value === SYS_PASS) {
        document.getElementById('modal-admin-login').style.display = 'none';
        document.getElementById('panel-admin').style.display = 'block';
        input.value = '';
        logDebug("Acceso Admin concedido.");
    } else {
        alert("ACCESO DENEGADO");
        input.value = '';
    }
}

function cerrarAdminPanel() {
    document.getElementById('panel-admin').style.display = 'none';
}

// --- CAMBIO DE MODOS ---
function cambiarModo() {
    const val = document.getElementById('source-selector').value;
    localStorage.setItem('sys_last_mode', val);

    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    document.getElementById('centinela-scroll').style.display = 'none';
    document.getElementById('loading-status').style.display = 'none';

    // A. MODO BOORUS
    if (BOORU_SITES[val]) {
        modoActual = 'booru_generic';
        currentBooru = val;

        // Asignamos color según el sitio (puedes añadir más si quieres)
        color = val === 'r34' ? '#3b82f6' : '#ea580c'; 

        document.getElementById('r34-inputs').style.display = 'block';
        feed.classList.add('tiktok-mode');
        document.getElementById('app-title').innerText = val.toUpperCase().replace('_', ' ') + " VIEWER";
        document.documentElement.style.setProperty('--accent', color);
    }
    // B. OTROS MODOS
    else {
        feed.classList.remove('tiktok-mode');
        if (val === '4chan') {
            modoActual = 'chan_catalog';
            document.getElementById('chan-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#009688');
            document.getElementById('app-title').innerText = "4CHAN BROWSER";
            if (typeof setupDropdown === 'function') setupDropdown('catalog');
        } else if (val === 'reddit') {
            modoActual = 'reddit';
            document.getElementById('reddit-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#ff4500');
            document.getElementById('app-title').innerText = "REDDIT FEED";
            feed.classList.add('tiktok-mode');
        } else if (val === 'x') {
            modoActual = 'x';
            document.getElementById('x-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#ffffff');
            document.getElementById('app-title').innerText = "X (TWITTER)";
        }
    }

    document.querySelectorAll('.input-group').forEach(el => {
        if (modoActual === 'booru_generic' && el.id === 'r34-inputs') return;
        if (el.id !== (modoActual === 'chan_catalog' ? 'chan-inputs' : modoActual + '-inputs')) el.style.display = 'none';
    });

    const btnSearch = document.querySelector('#r34-inputs .btn-action');
    if (btnSearch) {
        if (val === 'r34') btnSearch.innerText = "BUSCAR EN R34";
        else if (val.includes('booru')) btnSearch.innerText = "BUSCAR";
    }
}

function checkRedditInput() {
    const sel = document.getElementById('reddit-selector').value;
    const input = document.getElementById('reddit-custom');
    input.style.display = (sel === 'custom') ? 'block' : 'none';
}

// ==========================================
// 3. NETWORK & UTILS
// ==========================================

function detectType(url) {
    if (!url) return "img";
    const lower = url.toLowerCase();
    const fmtMatch = lower.match(/format=(\w+)/);
    if (fmtMatch) {
        const fmt = fmtMatch[1];
        if (["jpg", "jpeg", "png", "webp"].includes(fmt)) return "img";
        if (fmt === "gif") return "gif";
        if (["mp4", "mov", "webm"].includes(fmt)) return "vid";
    }
    if (lower.includes("v.redd.it") || lower.includes("redgifs.com") || lower.includes("gifdeliverynetwork")) return "vid";
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();
    if (["mp4", "webm", "m4v", "mov"].includes(ext)) return "vid";
    if (ext === "gif") return "gif";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "img";
    if (lower.includes("preview") || lower.includes("image") || lower.includes("media")) return "img";
    return "img";
}

async function fetchSmart(targetUrl) {
    // 4CHAN LOGIC (Sin cambios, solo logs)
    if (targetUrl.includes('4cdn.org')) {
        for (let proxyUrl of FOURCHAN_PROXIES) {
            try {
                const res = await fetch(proxyUrl + encodeURIComponent(targetUrl));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const txt = await res.text();
                if (!txt || txt.trim().startsWith('<')) continue;
                return JSON.parse(txt);
            } catch (e) { continue; }
        }
        if(window.debugEnabled) logDebug(`[RED] Fallaron todos los proxies de 4Chan.`);
        throw new Error("Proxies 4Chan fallaron");
    }

    // GENERAL LOGIC (Aquí es donde falla AP)
    for (let i = 0; i < PROXIES.length; i++) {
        const proxy = PROXIES[i];
        let finalUrl = (proxy.type === 'direct') ? targetUrl : proxy.url + encodeURIComponent(targetUrl);
        
        try {
            // Solo logueamos si el debug está activo para no ensuciar
            if (window.debugEnabled && modoActual === 'booru_generic') {
                logDebug(`[INTENTO ${i+1}] ${proxy.type.toUpperCase()}: ...`);
            }

            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const txt = await res.text();
            
            // Filtros de error comunes en proxies gratuitos
            if (txt.includes("Whoa there") || txt.includes("Too Many Requests")) throw new Error("Rate Limit / Bloqueo");
            if (txt.trim().startsWith('<') && !txt.includes('<?xml')) throw new Error("HTML devuelto en vez de JSON");
            
            let json;
            try { json = JSON.parse(txt); } catch (e) { throw new Error("No es JSON válido"); }
            
            // Desempaquetado especial para AllOrigins
            if (proxy.type === 'special_unpack') {
                if (json.contents) {
                    try { return JSON.parse(json.contents); } catch (e) { return json.contents; }
                }
            }
            
            if (window.debugEnabled && modoActual === 'booru_generic') logDebug(`[EXITO] Conexión establecida con Proxy ${i+1}`);
            return json;

        } catch (e) {
            if (window.debugEnabled && modoActual === 'booru_generic') {
                logDebug(`[FALLO] Proxy ${i+1} (${proxy.type}): ${e.message}`);
            }
            continue; // Prueba el siguiente
        }
    }
    
    if(window.debugEnabled) logDebug(`[RED FATAL] Todos los proxies fallaron para: ${targetUrl}`);
    throw new Error("Red falló: Ningún proxy pudo conectar.");
}

function ejecutarBusqueda() {
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('centinela-scroll').style.display = 'none';
    
    paginaActual = 0; redditAfter = ''; hayMas = true; cargando = false;

    if (modoActual === 'booru_generic' || modoActual === 'r34') cargarPaginaBooru(0);
    else if (modoActual === 'chan_catalog') cargarCatalogo4Chan();
    else if (modoActual === 'reddit') cargarPaginaReddit();
    else if (modoActual === 'x') cargarX();
}

function cargarSiguientePagina() {
    document.getElementById('centinela-scroll').innerText = "Cargando...";
    if (modoActual === 'booru_generic' || modoActual === 'r34') cargarPaginaBooru(paginaActual + 1);
    if (modoActual === 'reddit') cargarPaginaReddit();
}

// ==========================================
// 4. MOTORES (ENGINES)
// ==========================================

function buscarR34() { ejecutarBusqueda(); }

async function cargarPaginaBooru(pageNum) {
    if (cargando) return;
    cargando = true;

    const site = BOORU_SITES[currentBooru];
    const tags = misTags.join(' ') || document.getElementById('input-tags-real').value.trim();
    let url = '';

    if (site.adapter === 'ap_v3') {
        url = `${site.url}${site.endpoint}&page=${pageNum}&search_tag=${encodeURIComponent(tags)}`;
    } else {
        url = `${site.url}${site.endpoint}&limit=40&pid=${pageNum}&tags=${encodeURIComponent(tags)}`;
        if (site.key_needed) {
            const creds = getKeys();
            url += `&user_id=${creds.uid}&api_key=${creds.key}`;
        }
    }

    try {
        const rawData = await fetchSmart(url);
        let postsLimpios = [];
            postsLimpios = rawData;

        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';

        if (!postsLimpios.length) {
            hayMas = false;
            document.getElementById('centinela-scroll').innerText = "Fin.";
            return;
        }

        postsLimpios.forEach(item => {
            if (item.file_url) renderTarjetaR34(item);
        });
        paginaActual = pageNum;
        document.getElementById('centinela-scroll').innerText = "...";

    } catch (e) {
        document.getElementById('loading-status').innerText = `Error ${currentBooru}: ${e.message}`;
    } finally {
        cargando = false;
    }
}

function renderTarjetaR34(item) {
    const src = item.file_url;
    let prev = item.sample_url || item.preview_url || src;
    const type = detectType(src);
    if (type === 'gif' && prev.includes('.gif')) prev = item.preview_url || prev;
    renderCard(src, prev, type, item.tags, '', currentBooru);
}

// --- REDDIT ENGINE ---
function buscarReddit() { ejecutarBusqueda(); }

async function cargarPaginaReddit() {
    if (cargando) return;
    cargando = true;
    
    let sub = document.getElementById('reddit-selector').value;
    if (sub === 'custom') sub = document.getElementById('reddit-custom').value.trim();
    sub = sub.replace(/^(r\/|\/r\/|\/)/i, '');
    
    let url = `https://www.reddit.com/r/${sub}/hot.json?limit=20`;
    if (redditAfter) url += `&after=${redditAfter}`;
    
    try {
        const data = await fetchSmart(url);
        if (!data || !data.data || !Array.isArray(data.data.children)) throw new Error("Data inválida");
        
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        const posts = data.data.children;
        
        if (!posts.length) { hayMas = false; document.getElementById('centinela-scroll').innerText = "Fin."; return; }
        redditAfter = data.data.after;
        for (let i = 0; i < posts.length; i++) processRedditPost(posts[i].data);
        
    } catch (e) {
        document.getElementById('loading-status').innerText = `Error: ${e.message}`;
    } finally {
        cargando = false;
    }
}

function processRedditPost(p) {
    if (p.is_self) return;
    let src = p.url, prev = p.thumbnail, type = detectType(src);

    if (type === 'img') {
        if (p.preview?.images?.[0]?.resolutions?.length > 0) {
            const versiones = p.preview.images[0].resolutions;
            prev = versiones[versiones.length - 1].url.replace(/&amp;/g, '&');
        } else if (p.preview?.images?.[0]?.source) {
            prev = p.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else { prev = src; }
    } else if (p.domain.includes('redgifs') || p.domain.includes('v.redd.it')) {
        const vid = p.preview?.reddit_video_preview?.fallback_url || p.secure_media?.reddit_video?.fallback_url;
        if (!vid) return;
        src = vid; type = 'vid';
        if (p.preview?.images?.[0]?.source) prev = p.preview.images[0].source.url.replace(/&amp;/g, '&');
    }

    if (!prev || !prev.startsWith('http')) return;
    if (type === 'img' && !src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
    renderCard(src, prev, type, p.title, `u/${p.author}`, 'reddit');
}

// --- 4CHAN ENGINE ---
async function initChanAutocomplete() {
    const cached = localStorage.getItem('sys_chan_boards');
    try {
        const data = await fetchSmart('https://a.4cdn.org/boards.json');
        if (data && data.boards) {
            const cleanList = data.boards.map(b => ({ c: b.board, n: b.title }));
            localStorage.setItem('sys_chan_boards', JSON.stringify(cleanList));
        }
    } catch (e) {}
    setupChanInputListener();
}

function setupChanInputListener() {
    const inp = document.getElementById('chan-custom');
    const box = document.getElementById('chan-sugerencias');
    if (!inp || !box) return;

    inp.addEventListener('input', () => {
        const val = inp.value.toLowerCase().trim();
        if (val.length < 1) { box.style.display = 'none'; return; }
        const rawList = localStorage.getItem('sys_chan_boards');
        if (!rawList) return;
        const matches = JSON.parse(rawList).filter(b => b.c.toLowerCase().startsWith(val));
        
        box.innerHTML = '';
        if (matches.length === 0) { box.style.display = 'none'; return; }
        matches.forEach(b => {
            const item = document.createElement('div');
            item.className = 'chan-suggestion-item';
            item.innerHTML = `<span class="chan-code">/${b.c}/</span> <span class="chan-name">${b.n}</span>`;
            item.onclick = () => { inp.value = b.c; box.style.display = 'none'; };
            box.appendChild(item);
        });
        box.style.display = 'block';
    });
    document.addEventListener('click', (e) => { if (e.target !== inp && e.target !== box) box.style.display = 'none'; });
}

function checkChanInput() {
    const sel = document.getElementById('board-selector').value;
    const input = document.getElementById('chan-custom');
    if (input) {
        input.style.display = (sel === 'custom') ? 'block' : 'none';
        if (sel === 'custom') input.focus();
    }
}

async function cargarCatalogo4Chan() {
    modoActual = 'chan_catalog';
    let selectedBoard = document.getElementById('board-selector').value;
    if (selectedBoard === 'custom') {
        selectedBoard = document.getElementById('chan-custom').value.trim().replace(/\//g, '').toLowerCase();
    }
    if (!selectedBoard) { alert("Escribe un tablón."); return; }
    boardActual = selectedBoard;

    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('feed-infinito').classList.remove('tiktok-mode');
    document.getElementById('app-title').innerText = `4CHAN /${boardActual}/`;
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('loading-status').innerText = `Cargando /${boardActual}/...`;
    setupDropdown('catalog');

    try {
        const pages = await fetchSmart(`https://a.4cdn.org/${boardActual}/catalog.json`);
        document.getElementById('loading-status').style.display = 'none';
        catalogCache = [];
        pages.forEach(p => { if (p.threads) catalogCache.push(...p.threads); });
        if (catalogCache.length === 0) throw new Error("Vacío");
        renderCatalogoOrdenado();
    } catch (e) {
        document.getElementById('loading-status').innerText = "Error: " + e.message;
        document.getElementById('app-title').innerText = "ERROR";
    }
}

function setupDropdown(context) {
    const sortEl = document.getElementById('chan-sort');
    const mainBtn = document.getElementById('btn-chan-main');
    if (!sortEl || !mainBtn) return;
    sortEl.innerHTML = '';

    if (context === 'catalog') {
        mainBtn.style.display = 'block';
        mainBtn.innerText = "CARGAR TABLÓN";
        mainBtn.onclick = cargarCatalogo4Chan;
        const opts = [{v:'bump', t:'🔥 Activos'}, {v:'img', t:'🖼️ Más Img'}, {v:'new', t:'✨ Nuevos'}];
        opts.forEach(o => sortEl.add(new Option(o.t, o.v)));
        sortEl.onchange = () => renderCatalogoOrdenado();
    } else {
        mainBtn.style.display = 'none';
        const opts = [{v:'all', t:'👁️ Ver Todo'}, {v:'vid', t:'🎬 Videos'}, {v:'gif', t:'👾 GIFs'}, {v:'img', t:'📷 Img'}];
        opts.forEach(o => sortEl.add(new Option(o.t, o.v)));
        sortEl.onchange = () => { filtrarHiloEnVivo(); ocultarPanel(); };
    }
}

function renderCatalogoOrdenado() {
    if (modoActual !== 'chan_catalog') return;
    const sortEl = document.getElementById('chan-sort');
    document.getElementById('feed-infinito').innerHTML = '';
    let threads = [...catalogCache];
    
    if (sortEl.value === 'bump') threads.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0));
    else if (sortEl.value === 'new') threads.sort((a, b) => b.no - a.no);
    else if (sortEl.value === 'img') threads.sort((a, b) => (b.images || 0) - (a.images || 0));
    
    ocultarPanel();
    threads.forEach(thread => renderHilo4Chan(thread));
}

function renderHilo4Chan(t) {
    const thumb = `https://i.4cdn.org/${boardActual}/${t.tim}s.jpg`;
    const cleanDesc = (t.sub || t.com || "Sin descripción").replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 150);
    const card = document.createElement('div');
    card.className = 'tarjeta thread-card';
    card.onclick = () => cargarHiloCompleto(t.no, 'media');
    card.innerHTML = `<div class="media-wrapper" style="min-height:150px;position:relative;"><img class="media-content" src="${thumb}" loading="lazy" style="object-fit:contain;height:200px;"><div class="chan-choices"><button class="btn-choice" onclick="event.stopPropagation(); cargarHiloCompleto(${t.no}, 'media')" style="border-color:#00ffaa;">📷 MEDIA</button><button class="btn-choice" onclick="event.stopPropagation(); cargarHiloCompleto(${t.no}, 'all')" style="border-color:#ffaa00;">💬 CHAT</button></div></div><div class="thread-header"><span class="badge bg-chan">/${boardActual}/</span> <span style="color:#aaa; font-size:0.8rem">#${t.no}</span><div class="thread-title" style="font-size:0.8rem; margin-top:5px; font-weight:normal; color:#ddd">${cleanDesc}</div></div><div class="meta-footer"><span>📷 ${t.images}</span><span>💬 ${t.replies}</span></div>`;
    document.getElementById('feed-infinito').appendChild(card);
}

async function cargarHiloCompleto(threadId, viewMode) {
    scrollCatalogPos = window.scrollY;
    modoActual = 'chan_thread';
    threadViewMode = viewMode;
    ocultarPanel();
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    feed.classList.add('tiktok-mode');
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('nav-chan').style.display = 'block';
    setupDropdown('thread');

    try {
        const data = await fetchSmart(`https://a.4cdn.org/${boardActual}/thread/${threadId}.json`);
        document.getElementById('loading-status').style.display = 'none';
        let count = 0;
        data.posts.forEach(p => {
            const hasMedia = !!p.tim;
            if (viewMode === 'media' && !hasMedia) return;
            renderChanPost(p, hasMedia, viewMode);
            count++;
        });
        if (count === 0) document.getElementById('loading-status').innerText = "Hilo vacío.";
    } catch (e) { document.getElementById('loading-status').innerText = "Hilo muerto."; }
}

function renderChanPost(p, hasMedia, viewMode) {
    let type = 'text', src = '', prev = '', badgeHtml = '', fileInfo = '';
    if (hasMedia) {
        src = `https://i.4cdn.org/${boardActual}/${p.tim}${p.ext}`;
        prev = `https://i.4cdn.org/${boardActual}/${p.tim}s.jpg`;
        type = detectType(src);
        if (type === 'vid') badgeHtml = `<span class="badge bg-vid">VID</span>`;
        else if (type === 'gif') badgeHtml = `<span class="badge bg-gif">GIF</span>`;
        else badgeHtml = `<span class="badge bg-img">IMG</span>`;
        let cleanName = p.filename.length > 15 ? p.filename.substring(0, 15) + '...' : p.filename;
        fileInfo = `<span style="font-family:monospace; font-size:0.75rem; color:#aaa; margin-left:5px;">${cleanName}${p.ext}</span>`;
    } else { type = 'text'; badgeHtml = `<span class="badge" style="background:#333;">TXT</span>`; }

    let rawCom = p.com || "";
    let cleanComPreview = rawCom.replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 60) + "...";
    
    const card = document.createElement('div');
    card.className = 'tarjeta chan-post-item';
    card.dataset.filetype = type;

    let mediaEl = '';
    if (hasMedia) {
        if (type === 'vid') mediaEl = `<div class="media-wrapper"><video class="media-content" controls loop playsinline muted preload="metadata" poster="${prev}"><source src="${src}" type="video/mp4"><source src="${src}" type="video/webm"></video><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
        else if (type === 'gif') mediaEl = `<div class="media-wrapper" onclick="alternarGif(this,'${src}','${prev}')"><img class="media-content" src="${prev}" loading="lazy"><div class="overlay-btn">GIF</div><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
        else mediaEl = `<div class="media-wrapper"><img class="media-content" src="${prev}" loading="lazy" onclick="abrirLightbox('${src}','img')"><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else {
        mediaEl = `<div class="media-wrapper" style="align-items:center; padding:20px; box-sizing:border-box;"><div style="color:#ddd; font-size:1.1rem; text-align:center; line-height:1.5;">"${cleanComPreview}"</div></div>`;
    }

    let footerHtml = `<div class="meta-footer"><div style="display:flex; gap:10px; align-items:center;">${badgeHtml} <span class="badge bg-chan">#${p.no}</span> ${fileInfo}</div><div class="meta-desc-preview" onclick="toggleTags(this)">${cleanComPreview} <span class="ver-mas">Leer más</span></div></div><div class="tags-drawer"><div class="drawer-close-x" onclick="toggleTags(this)">✕</div><h3 style="color:#fff; margin: 0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333; padding-bottom:10px;">Comentario #${p.no}</h3><div class="drawer-tags-container" style="display:block; padding: 20px 20px 80px 20px;"><div style="color:#ddd; font-size:1rem; line-height:1.5; white-space:pre-wrap;">${rawCom}</div></div></div>`;
    
    card.innerHTML = mediaEl + footerHtml;
    if (type === 'vid') videoObserver.observe(card.querySelector('video'));
    document.getElementById('feed-infinito').appendChild(card);
}

function filtrarHiloEnVivo() {
    const filter = document.getElementById('chan-sort').value;
    const cards = document.querySelectorAll('.chan-post-item');
    cards.forEach(c => {
        const type = c.dataset.filetype;
        if (filter === 'all') c.style.display = 'block';
        else {
            if (type === filter) c.style.display = 'block';
            else c.style.display = 'none';
        }
    });
}

// --- X (NITTER) ---
function ejecutarBusquedaX() { ejecutarBusqueda(); }
const NITTER_MIRRORS = ["https://nitter.privacydev.net", "https://nitter.zackptg5.com", "https://nitter.kavin.rocks", "https://nitter.esmailelbob.xyz"];
async function fetchNitter(query) {
    for (let base of NITTER_MIRRORS) {
        try {
            const data = await fetchSmart(`${base}/search/rss?f=tweets&q=${encodeURIComponent(query)}`);
            if (data.trim().startsWith("<html")) continue;
            return { ok: true, xml: data };
        } catch (e) { continue; }
    }
    return { ok: false, error: "Nitter falló." };
}
async function cargarX() {
    const q = document.getElementById('x-search').value.trim();
    try {
        const out = await fetchNitter(q);
        if (!out.ok) { document.getElementById('loading-status').innerText = out.error; return; }
        const parser = new DOMParser();
        const xml = parser.parseFromString(out.xml, "text/xml");
        document.getElementById('loading-status').style.display = 'none';
        const items = xml.querySelectorAll('item');
        if (items.length === 0) { document.getElementById('loading-status').innerText = "Sin resultados."; return; }
        items.forEach(item => {
            const img = item.querySelector('description').textContent.match(/src="([^"]+)"/);
            if (img) renderCard(img[1], img[1], 'img', item.querySelector('title').textContent, 'X', 'x');
        });
    } catch (e) { document.getElementById('loading-status').innerText = e.message; }
}

// --- RENDER GENERICO ---
function renderCard(src, prev, type, tags, badgeTxt, context) {
    const card = document.createElement('div');
    card.className = 'tarjeta';
    let media = '', badge = '';
    if (type === 'vid') {
        badge = `<span class="badge bg-vid">VID</span>`;
        media = `<div class="media-wrapper"><video class="media-content" controls loop playsinline muted preload="metadata" poster="${prev}"><source src="${src}" type="video/mp4"><source src="${src}" type="video/webm"></video><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else if (type === 'gif') {
        badge = `<span class="badge bg-gif">GIF</span>`;
        media = `<div class="media-wrapper" onclick="alternarGif(this,'${src}','${prev}')"><img class="media-content" src="${prev}" loading="lazy"><div class="overlay-btn">GIF</div><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else {
        badge = `<span class="badge bg-img">IMG</span>`;
        media = `<div class="media-wrapper"><img class="media-content" src="${prev}" loading="lazy" onclick="abrirLightbox('${src}','img')"><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    }

    let footerHtml = '';
    if (context === 'r34' || context === 'booru_generic' || context === 'reddit') {
        let preview = "", drawerContent = "", sBadge = "", title = "";
        if (context === 'reddit') {
            sBadge = `<span class="badge bg-reddit">REDDIT</span>`;
            title = "Título";
            drawerContent = `<div style="color:#ddd; font-size:1.1rem; padding:10px;">${tags}</div>`;
            preview = tags.substring(0, 60) + "...";
        } else {
            let label = context === 'r34' ? 'R34' : context.substring(0,4).toUpperCase();
            sBadge = `<span class="badge" style="background:${color};">${label}</span>`;
            title = "Etiquetas";
            const tagsArr = tags.split(' ').filter(t=>t);
            preview = `${tagsArr.slice(0,5).join(', ')}... <span class="ver-mas">+${tagsArr.length-5}</span>`;
            drawerContent = `<div class="drawer-tags-container">${generarTagsHtml(tags)}</div>`;
        }
        footerHtml = `<div class="meta-footer"><div style="display:flex;gap:5px;">${badge} ${sBadge}</div><div class="meta-desc-preview" onclick="toggleTags(this)" style="margin-top:5px;">${preview}</div></div><div class="tags-drawer"><div class="drawer-close-x" onclick="toggleTags(this)">✕</div><h3 style="color:#fff; margin:0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333;">${title}</h3>${drawerContent}</div>`;
    } else {
        footerHtml = `<div class="meta-footer">${badge} <span style="font-size:0.7rem;color:#aaa;">${tags.substring(0,50)}...</span></div>`;
    }

    card.innerHTML = media + footerHtml;
    if (type === 'vid') videoObserver.observe(card.querySelector('video'));
    document.getElementById('feed-infinito').appendChild(card);
}

// --- UTILS ---
async function descargar(u) {
    const btn = event.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerText = "⏳";
    let success = false;
    for (let p of DOWNLOAD_PROXIES) {
        try {
            const res = await fetch(p + encodeURIComponent(u));
            if (!res.ok) throw new Error("Err");
            const blob = await res.blob();
            if (blob.size < 100) throw new Error("Vacio");
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = u.split('/').pop().split('?')[0] || 'file';
            document.body.appendChild(a); a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            success = true; break;
        } catch (e) {}
    }
    btn.disabled = false;
    btn.innerText = success ? "✅" : "⚠️";
    if (!success) setTimeout(() => { if(confirm("Error. Abrir?")) window.open(u, '_blank'); }, 500);
    setTimeout(() => btn.innerText = "⬇", 2000);
}

function alternarGif(w, g, p) {
    const i = w.querySelector('img');
    if (w.classList.contains('playing')) { i.src = p; w.classList.remove('playing'); }
    else { i.src = g; w.classList.add('playing'); }
}

function toggleTags(el) {
    const d = el.closest('.tarjeta').querySelector('.tags-drawer');
    d.classList.toggle('open');
}

function generarTagsHtml(t) {
    return t.split(' ').map(tag => tag ? `<span class="tag-chip" onclick="abrirModal('${tag}')">${tag}</span>` : '').join('');
}

function restoreCatalogScroll() {
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollCatalogPos)));
}

// --- LIGHTBOX ---
const lb = document.getElementById('lightbox');
const lbLayer = document.getElementById('lightbox-transform-layer');
let state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0, pinchDist: 0 };

function abrirLightbox(u, t) {
    lb.style.display = 'flex'; resetZoom(); lbLayer.innerHTML = '';
    if (t === 'vid') { lbLayer.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;max-height:100%;"></video>`; }
    else {
        const img = document.createElement('img');
        img.src = u; img.id = 'lightbox-img'; img.draggable = false;
        img.style.cssText = "max-width:100%; max-height:100%; object-fit:contain; pointer-events:auto; touch-action:none;";
        lbLayer.appendChild(img);
        initGestures(img);
    }
}

function cerrarLightbox() {
    const v = lbLayer.querySelector('video');
    if (v) { try { v.pause(); v.src = ""; } catch (_) {} }
    lb.style.display = 'none'; lbLayer.innerHTML = '';
}

function resetZoom() { state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0, pinchDist: 0 }; updateTransform(); }
function updateTransform() { lbLayer.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`; }

function initGestures(target) {
    let lastTap = 0;
    target.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 300) stepZoom();
        lastTap = now;
    });
    lb.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) { state.panning = false; state.pinchDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY); }
        else if (e.touches.length === 1 && state.scale > 1) { state.panning = true; state.startX = e.touches[0].clientX - state.pointX; state.startY = e.touches[0].clientY - state.pointY; }
    }, { passive: false });
    lb.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            if (state.pinchDist > 0) { state.scale = Math.min(Math.max(1, state.scale * (newDist / state.pinchDist)), 10); updateTransform(); state.pinchDist = newDist; }
        } else if (e.touches.length === 1 && state.panning && state.scale > 1) {
            state.pointX = e.touches[0].clientX - state.startX; state.pointY = e.touches[0].clientY - state.startY; updateTransform();
        }
    }, { passive: false });
    lb.addEventListener('touchend', (e) => {
        state.panning = false;
        if (e.touches.length < 2) state.pinchDist = 0;
        if (state.scale < 1) { state.scale = 1; state.pointX = 0; state.pointY = 0; lbLayer.style.transition = 'transform 0.3s ease'; updateTransform(); setTimeout(() => lbLayer.style.transition = 'none', 300); }
    });
}

function stepZoom() {
    lbLayer.style.transition = 'transform 0.2s ease-out';
    if (state.scale < 2) state.scale = 2.5; else if (state.scale < 4.5) state.scale = 6.0; else state.scale = 1;
    if (state.scale === 1) { state.pointX = 0; state.pointY = 0; }
    updateTransform();
    setTimeout(() => lbLayer.style.transition = 'none', 200);
}

// ==========================================
// AUTOCOMPLETADO (LÓGICA HÍBRIDA)
// ==========================================

const inp = document.getElementById('input-tags-real');
const rBox = document.getElementById('sugerencias-box');

inp.addEventListener('input', (e) => {
    const val = inp.value;
    if (val.trim().length < 2) { rBox.style.display = 'none'; return; }

    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(async () => {
        try {
            if(window.debugEnabled) logDebug(`[BUSCADOR] R34: "${val}"`);

            // Lógica estándar R34
            const query = val.trim().replace(/ /g, '_');
            const url = `https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(query)}`;
            const data = await fetchSmart(url);
            mostrarSugerenciasR34(data);

        } catch (e) {
            logDebug(`[ERROR] ${e.message}`);
        }
    }, 300);
});

// --- RENDERIZADO RULE34 (Simple) ---
function mostrarSugerenciasR34(data) {
    rBox.innerHTML = '';
    if (!data || !Array.isArray(data) || data.length === 0) { 
        rBox.style.display = 'none'; return; 
    }

    data.slice(0, 8).forEach(item => {
        crearElementoSugerencia(item.value, item.label, 'r34');
    });
    rBox.style.display = 'block';
}

// --- FACTORÍA COMÚN DE DOM ---
function crearElementoSugerencia(valorReal, textoMostrar, origen) {
    const d = document.createElement('div');
    d.className = 'sugerencia-item';
    
    // Estética: separar el nombre del contador si existe paréntesis
    let html = `<span>${valorReal}</span>`;
    if (textoMostrar.includes('(')) {
        const parts = textoMostrar.split('(');
        html = `<span>${parts[0]}</span><span style="color:#666; font-size:0.8rem; margin-left:auto;">(${parts[1]}</span>`;
    }
    
    d.innerHTML = html;
    
    d.onclick = () => {
       // Siempre forzamos guiones bajos porque ya no usamos AP
        const tagFinal = valorReal.replace(/ /g, '_');
        
        agregarTag(tagFinal);
        inp.value = '';
        rBox.style.display = 'none';
        inp.focus();
    };
    
    rBox.appendChild(d);
}

// Eventos de teclado (Enter y Backspace) se mantienen igual
// Manejo del ENTER y BACKSPACE (Versión Limpia)
inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        const t = inp.value.trim(); 
        if(t) { 
            // Como ya no usamos AP, siempre reemplazamos espacios por guiones bajos
            // para que Rule34 y otros boorus lo entiendan.
            const tagFinal = t.replace(/ /g, '_');
            
            agregarTag(tagFinal); 
            inp.value = ''; 
            rBox.style.display = 'none'; 
        } 
    }
    // Esto permite borrar el último tag (chip) si borras con la caja vacía
    if (e.key === 'Backspace' && !inp.value) { misTags.pop(); renderChips(); }
});


function agregarTag(t) { if (!misTags.includes(t)) { misTags.push(t); renderChips(); } }
function renderChips() {
    const c = document.getElementById('lista-chips'); c.innerHTML = '';
    misTags.forEach((t, i) => {
        const el = document.createElement('div'); el.className = 'tag-chip'; el.innerText = t;
        el.onclick = () => { misTags.splice(i, 1); renderChips(); };
        c.appendChild(el);
    });
}

function abrirModal(tag) {
    const m = document.getElementById('modal-tag-options');
    document.getElementById('modal-tag-name').innerText = tag; tagSeleccionadoTemp = tag; m.style.display = 'flex';
}
function cerrarModal(e) { const m = document.getElementById('modal-tag-options'); if (!e || e.target === m) m.style.display = 'none'; }
function accionTag(mode) {
    if (mode === 'add') agregarTag(tagSeleccionadoTemp);
    else if (mode === 'new') { misTags = [tagSeleccionadoTemp]; renderChips(); }
    cerrarModal(null); setTimeout(() => { cargando = false; buscarR34(); }, 50);
}

// --- INIT ---
window.onload = function() {
    initSecurityCheck(); 
    initDebugSystem(); 
    initChanAutocomplete();

    // Limpieza inicial
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'none';
    
    // ======================================================
    // 🔥 EL MOTOR DEL SCROLL INFINITO 🔥
    // ======================================================
    const sentinel = document.getElementById('centinela-scroll');
    const observer = new IntersectionObserver((entries) => {
        // Si el centinela es visible, no estamos cargando ya, y hay más páginas...
        if (entries[0].isIntersecting && !cargando && hayMas) {
            cargarSiguientePagina();
        }
    }, {
        root: null, 
        rootMargin: '400px', // Carga antes de llegar al fondo
        threshold: 0.1
    });
    
    if (sentinel) observer.observe(sentinel);
    // ======================================================

    // Recuperar sesión anterior
    const lastMode = localStorage.getItem('sys_last_mode') || 'r34';
    const sel = document.getElementById('source-selector');
    if (sel) sel.value = lastMode;
    
    cambiarModo(); 

    // --- AUTO-ARRANQUE INTELIGENTE ---
    if (lastMode === '4chan') {
        const btn = document.getElementById('btn-chan-main');
        if (btn) btn.onclick = cargarCatalogo4Chan;
        setTimeout(cargarCatalogo4Chan, 100);
    }
    else if (BOORU_SITES[lastMode]) {
        setTimeout(() => cargarPaginaBooru(0), 100);
    }
    else if (lastMode === 'reddit') {
        setTimeout(cargarPaginaReddit, 100);
    }

    if(document.getElementById('security-wall').style.display !== 'none') {
        setTimeout(() => document.getElementById('sys-access-pass').focus(), 100);
    }
    
    try { if (!SYS_PASS) console.error("Drivers faltantes"); } catch (e) {}
};

function initSecurityCheck() {
    if (localStorage.getItem('sys_access_token') === 'granted') {
        document.getElementById('security-wall').style.display = 'none'; return true;
    } return false;
}
function verifyAccess() {
    if (document.getElementById('sys-access-pass').value === SYS_PASS) {
        localStorage.setItem('sys_access_token', 'granted');
        document.getElementById('security-wall').style.display = 'none';
    } else { document.getElementById('access-error').style.display = 'block'; }
}
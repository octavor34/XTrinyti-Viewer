// ==========================================
// 1. SISTEMAS BASE (DEBUG & STATE)
// ==========================================

// --- SISTEMA DE DEBUG (FALLBACK) ---
if (typeof window.logDebug === 'undefined') {
    window.logDebug = function() {};
    window.initDebugSystem = function() {};
    window.toggleDebugMode = function() {
        alert("Módulo debug.js no cargado.");
    };
    window.clearDebugLog = function() {};
    window.updateDebugButtonUI = function() {};
}

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

// Estado del hilo 4chan
let threadFilterMode = 'all';
let threadViewMode = 'media';


let currentBooru = 'r34';


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
    setTimeout(() => {
        const inp = document.getElementById('admin-pass-input');
        if (inp) inp.focus();
    }, 100);
}

function checkAdminPass() {
    const input = document.getElementById('admin-pass-input');
    const val = input.value;
    
    if (val === SYS_PASS) {
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

// --- CAMBIO DE MODOS (ROUTER) ---
function cambiarModo() {
    const val = document.getElementById('source-selector').value;
    localStorage.setItem('sys_last_mode', val);

    // Limpieza Visual
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    document.getElementById('centinela-scroll').style.display = 'none';
    document.getElementById('loading-status').style.display = 'none';

    // A. MODO BOORUS (R34, AnimePictures, etc.)
    if (BOORU_SITES[val]) {
        modoActual = 'booru_generic';
        currentBooru = val;

        document.getElementById('r34-inputs').style.display = 'block';
        feed.classList.add('tiktok-mode'); // Activar Swipe

        document.getElementById('app-title').innerText = val.toUpperCase().replace('_', ' ') + " VIEWER";
        
        const color = val === 'anime_pictures' ? '#ff77aa' : '#3b82f6';
        document.documentElement.style.setProperty('--accent', color);
    }
    // B. OTROS MODOS (4chan, Reddit, X)
    else {
        feed.classList.remove('tiktok-mode'); // Reset por defecto

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
            feed.classList.add('tiktok-mode'); // Reddit también usa Swipe
        
        } else if (val === 'x') {
            modoActual = 'x';
            document.getElementById('x-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#ffffff');
            document.getElementById('app-title').innerText = "X (TWITTER)";
        }
    }

    // Ocultar inputs no usados
    document.querySelectorAll('.input-group').forEach(el => {
        if (modoActual === 'booru_generic' && el.id === 'r34-inputs') return;
        if (el.id !== (modoActual === 'chan_catalog' ? 'chan-inputs' : modoActual + '-inputs')) {
            el.style.display = 'none';
        }
    });

    // Actualizar texto del botón
    const btnSearch = document.querySelector('#r34-inputs .btn-action');
    if (btnSearch) {
        if (val === 'r34') btnSearch.innerText = "BUSCAR EN R34";
        else if (val === 'anime_pictures') btnSearch.innerText = "BUSCAR EN AP";
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
    
    // Detección por parámetros
    const fmtMatch = lower.match(/format=(\w+)/);
    if (fmtMatch) {
        const fmt = fmtMatch[1];
        if (["jpg", "jpeg", "png", "webp"].includes(fmt)) return "img";
        if (fmt === "gif") return "gif";
        if (["mp4", "mov", "webm"].includes(fmt)) return "vid";
    }
    
    // Dominios conocidos de video
    if (lower.includes("v.redd.it") || lower.includes("redgifs.com") || lower.includes("gifdeliverynetwork")) return "vid";
    
    // Extensiones
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();
    if (["mp4", "webm", "m4v", "mov"].includes(ext)) return "vid";
    if (ext === "gif") return "gif";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "img";
    
    return "img"; // Fallback
}

async function fetchSmart(targetUrl) {
    let lastError = null;
    
    // Lógica específica para 4chan (usa proxies distintos)
    if (targetUrl.includes('4cdn.org')) {
        for (let proxyUrl of FOURCHAN_PROXIES) {
            const urlToUse = proxyUrl + encodeURIComponent(targetUrl);
            try {
                const res = await fetch(urlToUse);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const txt = await res.text();
                if (!txt) throw new Error("Vacío");
                if (txt.trim().startsWith('<')) return txt;
                return JSON.parse(txt);
            } catch (e) { continue; }
        }
        throw new Error("Error Proxies 4Chan");
    }
    
    // Lógica General
    for (let i = 0; i < PROXIES.length; i++) {
        const proxy = PROXIES[i];
        let finalUrl;
        if (proxy.type === 'direct') finalUrl = targetUrl;
        else finalUrl = proxy.url + encodeURIComponent(targetUrl);
        
        try {
            const res = await fetch(finalUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const txt = await res.text();
            if (!txt) throw new Error("Respuesta vacía");
            if (txt.includes("Whoa there, pardner!") || txt.includes("Too Many Requests")) {
                throw new Error("Bloqueo de Reddit");
            }
            
            let json;
            try { json = JSON.parse(txt); } 
            catch (e) { throw new Error("No JSON"); }
            
            if (proxy.type === 'special_unpack') {
                if (json.contents) {
                    try { return JSON.parse(json.contents); } 
                    catch (e) { return json.contents; }
                }
            }
            return json;
        } catch (e) {
            lastError = e;
            continue;
        }
    }
    throw new Error(`Red falló. Último: ${lastError?.message}`);
}

function ejecutarBusqueda() {
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('centinela-scroll').style.display = 'none';
    
    paginaActual = 0; 
    redditAfter = ''; 
    hayMas = true; 
    cargando = false;

    // Ejecutar Driver
    if (modoActual === 'booru_generic' || modoActual === 'r34') {
        cargarPaginaBooru(0);
    }
    else if (modoActual === 'chan_catalog') cargarCatalogo4Chan();
    else if (modoActual === 'reddit') cargarPaginaReddit();
    else if (modoActual === 'x') cargarX();
}

function cargarSiguientePagina() {
    document.getElementById('centinela-scroll').innerText = "Cargando...";
    
    if (modoActual === 'booru_generic' || modoActual === 'r34') {
        cargarPaginaBooru(paginaActual + 1);
    }
    if (modoActual === 'reddit') {
        cargarPaginaReddit();
    }
}


// ==========================================
// 4. MOTORES (ENGINES)
// ==========================================

// --- BOORUS (Rule34, AnimePictures, etc) ---
function buscarR34() { ejecutarBusqueda(); }

async function cargarPaginaBooru(pageNum) {
    if (cargando) return;
    cargando = true;

    const site = BOORU_SITES[currentBooru];
    const tags = misTags.join(' ') || document.getElementById('input-tags-real').value.trim();
    let url = '';

    // Adaptador de URL
    if (site.adapter === 'ap_v3') {
        url = `${site.url}${site.endpoint}&page=${pageNum}&search_tag=${encodeURIComponent(tags)}`;
    } else {
        url = `${site.url}${site.endpoint}&limit=10&pid=${pageNum}&tags=${encodeURIComponent(tags)}`;
        if (site.key_needed) {
            const creds = getKeys();
            url += `&user_id=${creds.uid}&api_key=${creds.key}`;
        }
    }

    try {
        const rawData = await fetchSmart(url);
        let postsLimpios = [];

        // Adaptador de Datos
        if (site.adapter === 'ap_v3') {
            if (!rawData.posts) throw new Error("Invalid API structure");
            postsLimpios = rawData.posts.map(p => {
                return {
                    file_url: p.file_url ? `https://anime-pictures.net${p.file_url}` : '',
                    preview_url: p.small_preview ? `https://anime-pictures.net${p.small_preview}` : '',
                    type: 'img',
                    tags: "Tags complex (View on site)"
                };
            });
        } else {
            postsLimpios = rawData;
        }

        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';

        if (!postsLimpios.length) {
            hayMas = false;
            document.getElementById('centinela-scroll').innerText = "Fin de resultados.";
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


// --- REDDIT ---
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
        if (!data || !data.data || !Array.isArray(data.data.children)) throw new Error("Reddit invalido");
        
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        
        const posts = data.data.children;
        if (!posts.length) {
            hayMas = false;
            document.getElementById('centinela-scroll').innerText = "Fin.";
            return;
        }
        
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

    let src = p.url;
    let prev = p.thumbnail;
    let type = detectType(src);

    // Smart Resizing (Punto Medio)
    if (type === 'img') {
        if (p.preview?.images?.[0]?.resolutions?.length > 0) {
            const versiones = p.preview.images[0].resolutions;
            const puntoMedio = versiones[versiones.length - 1];
            prev = puntoMedio.url.replace(/&amp;/g, '&');
        } else if (p.preview?.images?.[0]?.source) {
            prev = p.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else {
            prev = src; // Fallback
        }
    }
    // Video
    else if (p.domain.includes('redgifs') || p.domain.includes('v.redd.it')) {
        const vid = p.preview?.reddit_video_preview?.fallback_url || p.secure_media?.reddit_video?.fallback_url;
        if (!vid) return;
        src = vid;
        type = 'vid';
        if (p.preview?.images?.[0]?.resolutions?.length > 0) {
            const versiones = p.preview.images[0].resolutions;
            prev = versiones[versiones.length - 1].url.replace(/&amp;/g, '&');
        }
    }

    if (!prev || !prev.startsWith('http')) return;
    if (type === 'img' && !src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;

    renderCard(src, prev, type, p.title, `u/${p.author}`, 'reddit');
}


// --- 4CHAN MODULE ---

// Autocompletado
async function initChanAutocomplete() {
    const cached = localStorage.getItem('sys_chan_boards');
    // Intentamos actualizar siempre en background
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
        const list = JSON.parse(rawList);
        
        const matches = list.filter(b => b.c.toLowerCase().startsWith(val));
        
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
    
    document.addEventListener('click', (e) => {
        if (e.target !== inp && e.target !== box) box.style.display = 'none';
    });
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
        const customVal = document.getElementById('chan-custom').value.trim();
        selectedBoard = customVal.replace(/\//g, '').toLowerCase();
    }

    if (!selectedBoard) { alert("Escribe un nombre de tablón."); return; }
    boardActual = selectedBoard;

    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('feed-infinito').classList.remove('tiktok-mode');
    document.getElementById('app-title').innerText = `4CHAN /${boardActual}/`;

    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('loading-status').innerText = `Cargando /${boardActual}/...`;
    document.getElementById('centinela-scroll').style.display = 'none';

    setupDropdown('catalog');

    const url = `https://a.4cdn.org/${boardActual}/catalog.json`;
    try {
        const pages = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        catalogCache = [];
        pages.forEach(p => { if (p.threads) catalogCache.push(...p.threads); });
        if (catalogCache.length === 0) throw new Error("Vacío");
        renderCatalogoOrdenado();
    } catch (e) {
        document.getElementById('loading-status').innerText = "Error 4Chan: " + e.message;
        document.getElementById('app-title').innerText = "4CHAN ERROR";
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
        const opts = [{v: 'bump', t: '🔥 Activos'}, {v: 'img', t: '🖼️ Más Img'}, {v: 'new', t: '✨ Nuevos'}];
        opts.forEach(o => sortEl.add(new Option(o.t, o.v)));
        sortEl.onchange = () => { renderCatalogoOrdenado(); };
        
    } else if (context === 'thread') {
        mainBtn.style.display = 'none';
        const opts = [{v: 'all', t: '👁️ Ver Todo'}, {v: 'vid', t: '🎬 Solo Videos'}, {v: 'gif', t: '👾 Solo GIFs'}, {v: 'img', t: '📷 Solo JPG/PNG'}];
        opts.forEach(o => sortEl.add(new Option(o.t, o.v)));
        sortEl.onchange = () => { filtrarHiloEnVivo(); ocultarPanel(); };
    }
}

function renderCatalogoOrdenado() {
    if (modoActual !== 'chan_catalog') return;
    const sortEl = document.getElementById('chan-sort');
    if (!sortEl) return;
    document.getElementById('feed-infinito').innerHTML = '';
    
    const sortMode = sortEl.value;
    let threads = [...catalogCache];
    if (sortMode === 'bump') threads.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0));
    else if (sortMode === 'new') threads.sort((a, b) => b.no - a.no);
    else if (sortMode === 'img') threads.sort((a, b) => (b.images || 0) - (a.images || 0));
    
    ocultarPanel();
    threads.forEach(thread => renderHilo4Chan(thread));
}

function renderHilo4Chan(t) {
    const thumb = `https://i.4cdn.org/${boardActual}/${t.tim}s.jpg`;
    const cleanDesc = (t.sub || t.com || "Sin descripción").replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 150);
    
    const card = document.createElement('div');
    card.className = 'tarjeta thread-card';
    card.onclick = () => cargarHiloCompleto(t.no, 'media');

    card.innerHTML = `
        <div class="media-wrapper" style="min-height:150px; position:relative;">
            <img class="media-content" src="${thumb}" loading="lazy" style="object-fit:contain;height:200px;">
            <div class="chan-choices">
                <button class="btn-choice" onclick="event.stopPropagation(); cargarHiloCompleto(${t.no}, 'media')" style="border-color:#00ffaa;">📷 MEDIA</button>
                <button class="btn-choice" onclick="event.stopPropagation(); cargarHiloCompleto(${t.no}, 'all')" style="border-color:#ffaa00;">💬 CHAT</button>
            </div>
        </div>
        <div class="thread-header">
            <span class="badge bg-chan">/${boardActual}/</span> 
            <span style="color:#aaa; font-size:0.8rem">#${t.no}</span>
            <div class="thread-title" style="font-size:0.8rem; margin-top:5px; font-weight:normal; color:#ddd">${cleanDesc}</div>
        </div>
        <div class="meta-footer"><span>📷 ${t.images}</span><span>💬 ${t.replies}</span></div>`;
    document.getElementById('feed-infinito').appendChild(card);
}

async function cargarHiloCompleto(threadId, viewMode) {
    scrollCatalogPos = window.scrollY;
    modoActual = 'chan_thread';
    threadViewMode = viewMode;

    ocultarPanel();
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    feed.classList.add('tiktok-mode'); // Swipe ON

    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('nav-chan').style.display = 'block';
    setupDropdown('thread');

    const url = `https://a.4cdn.org/${boardActual}/thread/${threadId}.json`;
    try {
        const data = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';

        let count = 0;
        data.posts.forEach(p => {
            const hasMedia = !!p.tim;
            if (viewMode === 'media' && !hasMedia) return;
            renderChanPost(p, hasMedia, viewMode);
            count++;
        });

        if (count === 0) document.getElementById('loading-status').innerText = "Hilo vacío.";
    } catch (e) {
        document.getElementById('loading-status').innerText = "Hilo muerto.";
    }
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
    } else {
        type = 'text';
        badgeHtml = `<span class="badge" style="background:#333;">TXT</span>`;
    }

    let rawCom = p.com || "";
    let cleanComPreview = rawCom.replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 60);
    if (cleanComPreview.length >= 60) cleanComPreview += "...";
    if (!cleanComPreview) cleanComPreview = "Sin comentario";

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

    let footerHtml = `
        <div class="meta-footer">
            <div style="display:flex; gap:10px; align-items:center;">
                ${badgeHtml} <span class="badge bg-chan">#${p.no}</span> ${fileInfo}
            </div>
            <div class="meta-desc-preview" onclick="toggleTags(this)">
                ${cleanComPreview} <span class="ver-mas">Leer más</span>
            </div>
        </div>
        <div class="tags-drawer">
            <div class="drawer-close-x" onclick="toggleTags(this)">✕</div>
            <h3 style="color:#fff; margin: 0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333; padding-bottom:10px;">Comentario #${p.no}</h3>
            <div class="drawer-tags-container" style="display:block; padding: 20px 20px 80px 20px;">
                <div style="color:#ddd; font-size:1rem; line-height:1.5; white-space:pre-wrap;">${rawCom}</div>
            </div>
        </div>`;

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

function volverCatalogo() {
    modoActual = 'chan_catalog';
    chanCursor = 0;
    isInThread = false;

    ocultarPanel();
    setupDropdown('catalog');
    document.getElementById('nav-chan').style.display = 'none';
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    feed.classList.remove('tiktok-mode');

    if (catalogCache && catalogCache.length > 0) {
        renderCatalogoOrdenado();
        restoreCatalogScroll();
        return;
    }
    cargarCatalogo4Chan().then(() => { restoreCatalogScroll(); });
}


// ==========================================
// 5. X (NITTER) & RENDERIZADO
// ==========================================

function ejecutarBusquedaX() { ejecutarBusqueda(); }
const NITTER_MIRRORS = ["https://nitter.privacydev.net", "https://nitter.zackptg5.com", "https://nitter.kavin.rocks", "https://nitter.esmailelbob.xyz"];

async function fetchNitter(query) {
    for (let base of NITTER_MIRRORS) {
        const url = `${base}/search/rss?f=tweets&q=${encodeURIComponent(query)}`;
        try {
            const data = await fetchSmart(url);
            if (data.trim().startsWith("<html")) continue;
            return { ok: true, xml: data, mirror: base };
        } catch (e) { continue; }
    }
    return { ok: false, error: "Todos los mirrors de Nitter fallaron." };
}

async function cargarX() {
    const q = document.getElementById('x-search').value.trim();
    try {
        const out = await fetchNitter(q);
        if (!out.ok) { document.getElementById('loading-status').innerText = out.error; return; }
        const parser = new DOMParser();
        const xml = parser.parseFromString(out.xml, "text/xml");
        if (xml.querySelector("parsererror")) { document.getElementById('loading-status').innerText = "Error XML."; return; }
        document.getElementById('loading-status').style.display = 'none';
        const items = xml.querySelectorAll('item');
        if (items.length === 0) { document.getElementById('loading-status').innerText = "Sin resultados."; return; }
        items.forEach(item => {
            const desc = item.querySelector('description').textContent;
            const img = desc.match(/src="([^"]+)"/);
            if (img) renderCard(img[1], img[1], 'img', item.querySelector('title').textContent, 'X', 'x');
        });
    } catch (e) { document.getElementById('loading-status').innerText = e.message; }
}

// --- RENDERIZADOR UNIVERSAL (TIKTOK STYLE) ---
function renderCard(src, prev, type, tags, badgeTxt, context) {
    const card = document.createElement('div');
    card.className = 'tarjeta';

    // A. MEDIA CONTENT
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

    // B. FOOTER Y DRAWER
    let footerHtml = '';
    
    if (context === 'r34' || context === 'booru_generic' || context === 'reddit') {
        let previewText = "", drawerContent = "", sourceBadge = "", drawerTitle = "";

        if (context === 'reddit') {
            sourceBadge = `<span class="badge bg-reddit">REDDIT</span> <span class="badge" style="background:#333; font-size:0.6rem;">${badgeTxt}</span>`;
            const title = tags;
            previewText = title.length > 60 ? title.substring(0, 60) + "..." : title;
            drawerTitle = "Título Completo";
            drawerContent = `<div style="color:#ddd; font-size:1.1rem; line-height:1.5; padding:10px;">${title}</div>`;
        } else {
            let siteLabel = context === 'r34' ? 'R34' : context.substring(0, 4).toUpperCase();
            if (context === 'anime_pictures') siteLabel = 'AP';
            let badgeColor = (context === 'anime_pictures') ? '#ff77aa' : (context === 'safebooru' ? '#22c55e' : '#3b82f6');
            
            sourceBadge = `<span class="badge" style="background:${badgeColor};">${siteLabel}</span>`;
            
            const tagsArray = tags.split(' ').filter(t => t.length > 0);
            const shortTagsStr = tagsArray.slice(0, 5).join(', ');
            const remaining = tagsArray.length - 5;
            previewText = `${shortTagsStr}... <span class="ver-mas">${remaining > 0 ? '+'+remaining : ''}</span>`;
            drawerTitle = "Etiquetas";
            drawerContent = `<div class="drawer-tags-container">${generarTagsHtml(tags)}</div>`;
        }

        footerHtml = `
            <div class="meta-footer">
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">${badge} ${sourceBadge}</div>
                <div class="meta-desc-preview" onclick="toggleTags(this)" style="margin-top:5px;">${previewText}</div>
            </div>
            <div class="tags-drawer">
                <div class="drawer-close-x" onclick="toggleTags(this)">✕</div>
                <h3 style="color:#fff; margin: 0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333; padding-bottom:10px;">${drawerTitle}</h3>
                ${drawerContent}
            </div>`;
    } else {
        if (badgeTxt) badge += ` <span class="badge bg-x">${badgeTxt}</span>`;
        footerHtml = `<div class="meta-footer">${badge} <span style="font-size:0.7rem;color:#aaa; margin-left:10px;">${tags.substring(0,50)}...</span></div>`;
    }

    card.innerHTML = media + footerHtml;
    if (type === 'vid') videoObserver.observe(card.querySelector('video'));
    document.getElementById('feed-infinito').appendChild(card);
}


// ==========================================
// 6. UTILIDADES Y DESCARGAS
// ==========================================

async function descargar(u) {
    const btn = event.currentTarget;
    const iconOriginal = btn.innerText;
    if (btn.disabled) return;
    btn.disabled = true;
    
    const esVideo = u.match(/\.(mp4|webm|mov)$/i);
    btn.innerText = esVideo ? "🎞️" : "⏳";

    let downloadSuccess = false;

    for (let proxyBase of DOWNLOAD_PROXIES) {
        try {
            const target = proxyBase + encodeURIComponent(u);
            const response = await fetch(target);
            if (!response.ok) throw new Error("HTTP Error");
            
            const blob = await response.blob();
            if (blob.size < 100) throw new Error("Blob vacío");

            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            const cleanName = u.split('/').pop().split('?')[0] || `descarga_${Date.now()}`;
            a.download = cleanName;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => { window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a); }, 100);
            downloadSuccess = true;
            break;
        } catch (e) { console.warn("Proxy falló:", e.message); }
    }

    btn.disabled = false;
    if (downloadSuccess) {
        btn.innerText = "✅";
        setTimeout(() => btn.innerText = iconOriginal, 2000);
    } else {
        btn.innerText = "⚠️";
        setTimeout(() => {
            if (confirm("Descarga fallida. ¿Abrir en pestaña?")) window.open(u, '_blank');
            btn.innerText = iconOriginal;
        }, 500);
    }
}

function alternarGif(w, g, p) {
    const i = w.querySelector('img');
    if (w.classList.contains('playing')) { i.src = p; w.classList.remove('playing'); } 
    else { i.src = g; w.classList.add('playing'); }
}

function toggleTags(el) {
    const card = el.closest('.tarjeta');
    const drawer = card.querySelector('.tags-drawer');
    if (drawer.classList.contains('open')) drawer.classList.remove('open');
    else drawer.classList.add('open');
}

function generarTagsHtml(t) {
    return t.split(' ').map(tag => tag ? `<span class="tag-chip" style="font-size:0.7rem;margin:2px" onclick="abrirModal('${tag}')">${tag}</span>` : '').join('');
}

function restoreCatalogScroll() {
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollCatalogPos)));
}


// ==========================================
// 7. LIGHTBOX & GESTURES
// ==========================================

const lb = document.getElementById('lightbox');
const lbLayer = document.getElementById('lightbox-transform-layer');
let state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0, pinchDist: 0 };

function abrirLightbox(u, t) {
    lb.style.display = 'flex';
    resetZoom();
    lbLayer.innerHTML = '';
    if (t === 'vid') {
        lbLayer.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;max-height:100%;"></video>`;
    } else {
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
    lb.style.display = 'none';
    lbLayer.innerHTML = '';
    resetZoom();
}

function resetZoom() {
    state = { scale: 1, panning: false, pointX: 0, pointY: 0, startX: 0, startY: 0, pinchDist: 0 };
    updateTransform();
}

function updateTransform() {
    lbLayer.style.transform = `translate(${state.pointX}px, ${state.pointY}px) scale(${state.scale})`;
}

function initGestures(target) {
    let lastTap = 0;
    target.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 300) stepZoom();
        lastTap = now;
    });

    lb.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            state.panning = false;
            state.pinchDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        } else if (e.touches.length === 1) {
            if (state.scale > 1) {
                state.panning = true;
                state.startX = e.touches[0].clientX - state.pointX;
                state.startY = e.touches[0].clientY - state.pointY;
            }
        }
    }, { passive: false });

    lb.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const newDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            if (state.pinchDist > 0) {
                const diff = newDist / state.pinchDist;
                state.scale = Math.min(Math.max(1, state.scale * diff), 10);
                updateTransform();
                state.pinchDist = newDist;
            }
        } else if (e.touches.length === 1 && state.panning && state.scale > 1) {
            state.pointX = e.touches[0].clientX - state.startX;
            state.pointY = e.touches[0].clientY - state.startY;
            updateTransform();
        }
    }, { passive: false });

    lb.addEventListener('touchend', (e) => {
        state.panning = false;
        if (e.touches.length < 2) state.pinchDist = 0;
        if (state.scale < 1) {
            state.scale = 1; state.pointX = 0; state.pointY = 0;
            lbLayer.style.transition = 'transform 0.3s ease';
            updateTransform();
            setTimeout(() => { lbLayer.style.transition = 'none'; }, 300);
        }
    });
}

function stepZoom() {
    lbLayer.style.transition = 'transform 0.2s ease-out';
    if (state.scale < 2) state.scale = 2.5;
    else if (state.scale < 4.5) state.scale = 6.0;
    else { state.scale = 1; state.pointX = 0; state.pointY = 0; }
    updateTransform();
    setTimeout(() => { lbLayer.style.transition = 'none'; }, 200);
}


// ==========================================
// 8. OBSERVERS & AUTOCOMPLETADO (R34)
// ==========================================

const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
            if (video.readyState === 0) video.load();
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => { video.muted = true; video.play(); });
            }
            video.closest('.media-wrapper').classList.add('playing');
        } else {
            video.pause();
            video.closest('.media-wrapper').classList.remove('playing');
        }
    });
}, { threshold: 0.7 });

const scrollObserver = new IntersectionObserver((es) => {
    if (es[0].isIntersecting && !cargando && hayMas && (modoActual === 'booru_generic' || modoActual === 'r34' || modoActual === 'reddit')) {
        cargarSiguientePagina();
    }
}, { rootMargin: '600px' });
scrollObserver.observe(document.getElementById('centinela-scroll'));

// R34 Auto-Suggest
const inp = document.getElementById('input-tags-real');
const rBox = document.getElementById('sugerencias-box');

// Listener inteligente de Autocompletado
inp.addEventListener('input', (e) => {
    const val = inp.value;
    if (val.trim().length < 2) { rBox.style.display = 'none'; return; }

    // 1. CONFIGURACIÓN DINÁMICA DE API
    let autoUrl = '';
    let parserType = 'standard'; // 'standard' (R34) o 'ap' (AnimePictures)

    if (currentBooru === 'r34') {
        const query = val.trim().replace(/ /g, '_');
        autoUrl = `https://api.rule34.xxx/autocomplete.php?q=${query}`;
    } 
    else if (currentBooru === 'anime_pictures') {
        // API específica de Anime-Pictures
        parserType = 'ap';
        const query = encodeURIComponent(val.trim());
        autoUrl = `https://anime-pictures.net/api/v3/tags?tag=${query}&lang=en`;
    } 
    else {
        // Si el sitio no tiene soporte de autocompletado configurado, salimos
        rBox.style.display = 'none';
        return;
    }

    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(async () => {
        try {
            // fetchSmart se encarga de los proxies si hay CORS
            const d = await fetchSmart(autoUrl);
            mostrarSugerenciasR34(d, parserType);
        } catch (e) {
            console.warn("Fallo autocompletado:", e);
        }
    }, 300);
});

function mostrarSugerenciasR34(data, type = 'standard') {
    rBox.innerHTML = '';
    let listaLimpia = [];

    // 1. ADAPTADOR DE DATOS
    if (type === 'ap') {
        // Estructura Anime-Pictures: { success: true, tags: [ { tag: "blue eyes", ... } ] }
        if (data && data.tags) {
            listaLimpia = data.tags.map(t => ({ 
                value: t.tag, 
                label: t.tag // AP no suele mandar el count aquí, usamos el nombre
            }));
        }
    } else {
        // Estructura Rule34: [ { label: "tag (123)", value: "tag" }, ... ]
        if (Array.isArray(data)) {
            listaLimpia = data;
        }
    }

    // Si no hay resultados
    if (!listaLimpia || !listaLimpia.length) { 
        rBox.style.display = 'none'; 
        return; 
    }

    // 2. RENDERIZADO
    listaLimpia.slice(0, 8).forEach(i => {
        const d = document.createElement('div');
        d.className = 'sugerencia-item';
        
        const v = i.value;
        // Procesamiento del contador (solo si existe en el label y es R34)
        let count = '';
        if (i.label && i.label.includes('(')) {
            count = i.label.split('(')[1].replace(')', '');
        }
        
        d.innerHTML = `<span>${v}</span><span style="color:#666; font-size:0.8rem">${count}</span>`;
        
        d.onclick = () => {
            // Si es R34 reemplazamos espacios por guiones, si es AP lo dejamos natural
            let tagFinal = v;
            if (currentBooru === 'r34') tagFinal = v.replace(/ /g, '_');
            
            agregarTag(tagFinal);
            inp.value = '';
            rBox.style.display = 'none';
            inp.focus();
        };
        rBox.appendChild(d);
    });
    rBox.style.display = 'block';
}

inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const textoFinal = inp.value.trim();
        if (textoFinal) { agregarTag(textoFinal.replace(/ /g, '_')); inp.value = ''; rBox.style.display = 'none'; }
    }
    if (e.key === 'Backspace' && !inp.value) { misTags.pop(); renderChips(); }
});

function agregarTag(t) {
    if (!misTags.includes(t)) { misTags.push(t); renderChips(); }
}

function renderChips() {
    const c = document.getElementById('lista-chips');
    c.innerHTML = '';
    misTags.forEach((t, i) => {
        const el = document.createElement('div');
        el.className = 'tag-chip';
        el.innerText = t;
        el.onclick = () => { misTags.splice(i, 1); renderChips(); };
        c.appendChild(el);
    });
}

// Modal Tags
function abrirModal(tag) {
    const modal = document.getElementById('modal-tag-options');
    document.getElementById('modal-tag-name').innerText = tag;
    tagSeleccionadoTemp = tag;
    modal.style.display = 'flex';
}

function cerrarModal(e) {
    const modal = document.getElementById('modal-tag-options');
    if (!e || e.target === modal) { modal.style.display = 'none'; }
}

function accionTag(mode) {
    if (mode === 'add') {
        agregarTag(tagSeleccionadoTemp);
        cerrarModal(null);
        setTimeout(() => { cargando = false; buscarR34(); }, 50);
    } else if (mode === 'new') {
        misTags = [tagSeleccionadoTemp];
        renderChips();
        cerrarModal(null);
        setTimeout(() => { cargando = false; buscarR34(); }, 50);
    }
}


// ==========================================
// 9. INIT
// ==========================================

window.onload = function() {
    initSecurityCheck();
    initDebugSystem();
    
    // Iniciar Autocompletado 4chan
    initChanAutocomplete();

    // Limpieza
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'none';

    // Recuperar Sesión
    const lastMode = localStorage.getItem('sys_last_mode') || 'r34';
    const sel = document.getElementById('source-selector');
    if (sel) sel.value = lastMode;
    
    cambiarModo();

    // Auto-arranque 4chan si corresponde
    if (lastMode === '4chan') {
        const btnChan = document.getElementById('btn-chan-main');
        if (btnChan) btnChan.onclick = cargarCatalogo4Chan;
        setTimeout(cargarCatalogo4Chan, 100);
    }
    
    // Focus en seguridad si está activo
    if(document.getElementById('security-wall').style.display !== 'none') {
        setTimeout(() => document.getElementById('sys-access-pass').focus(), 100);
    }

    try { if (!SYS_PASS) console.error("Drivers.js no cargado!"); } catch (e) {}
};

// --- SISTEMA DE SEGURIDAD ---
function initSecurityCheck() {
    const token = localStorage.getItem('sys_access_token');
    if (token === 'granted') {
        const wall = document.getElementById('security-wall');
        if(wall) wall.style.display = 'none';
        return true;
    }
    return false;
}

function verifyAccess() {
    const input = document.getElementById('sys-access-pass');
    const err = document.getElementById('access-error');
    if (input.value === SYS_PASS) {
        localStorage.setItem('sys_access_token', 'granted');
        document.getElementById('security-wall').style.display = 'none';
    } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
    }
}
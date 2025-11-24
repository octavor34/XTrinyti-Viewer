// --- SISTEMA DE DEBUG (FALLBACK) ---
// Si debug.js no está cargado en el HTML, estas funciones vacías evitan que la app explote.
if (typeof window.logDebug === 'undefined') {
    window.logDebug = function() {}; 
    window.initDebugSystem = function() {};
    window.toggleDebugMode = function() { alert("Módulo debug.js no cargado. Añade <script src='debug.js'></script> al HTML."); };
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

// --- SITE CONFIGURATION (BOORUS) ---
const BOORU_SITES = {
    'r34': {
        url: 'https://api.rule34.xxx',
        endpoint: '/index.php?page=dapi&s=post&q=index&json=1',
        key_needed: true,
        adapter: 'standard' // Standard Rule34/Gelbooru
    },
    'anime_pictures': {
        url: 'https://anime-pictures.net',
        endpoint: '/api/v3/posts?lang=en', // API V3 Specific
        key_needed: false,
        adapter: 'ap_v3' // Requires translation
    }
};

let currentBooru = 'r34';

// --- UI HELPERS ---
function toggleMenu() {
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    if (p.style.display === 'none' || p.style.display === '') {
        p.style.display = 'block';
        b.style.display = 'block'; 
        if (modoActual === 'r34') {
            const input = document.getElementById('input-tags-real');
            if(input) input.focus();
        }
    } else {
        p.style.display = 'none';
        b.style.display = 'none'; 
    }
}

function ocultarPanel(){
    const p = document.getElementById('panel-control');
    const b = document.getElementById('menu-backdrop');
    if(p) p.style.display = 'none';
    if(b) b.style.display = 'none';
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
        if(inp) inp.focus();
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

// --- CAMBIO DE MODOS ---
function cambiarModo() {
    const val = document.getElementById('source-selector').value;
    localStorage.setItem('sys_last_mode', val);

    // Visual Cleanup
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    document.getElementById('centinela-scroll').style.display = 'none';
    document.getElementById('loading-status').style.display = 'none';

    // --- BOORU DETECTION (R34 & ANIME-PICTURES) ---
    if (BOORU_SITES[val]) {
        modoActual = 'booru_generic';
        currentBooru = val; 
        
        // Reuse R34 interface and activate TikTok mode
        document.getElementById('r34-inputs').style.display = 'block';
        feed.classList.add('tiktok-mode'); 
        
        // Custom title
        document.getElementById('app-title').innerText = val.toUpperCase().replace('_', ' ') + " VIEWER";
        
        // Color theme adjustment
        const color = val === 'anime_pictures' ? '#ff77aa' : '#3b82f6';
        document.documentElement.style.setProperty('--accent', color);
    } 
    // --- OTHER MODES (4chan, Reddit, X) ---
    else {
        feed.classList.remove('tiktok-mode'); 
        
        if(val === '4chan') {
            modoActual = 'chan_catalog';
            document.getElementById('chan-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#009688');
            document.getElementById('app-title').innerText = "4CHAN BROWSER";
            if(typeof setupDropdown === 'function') setupDropdown('catalog');
        } else if(val === 'reddit') {
            modoActual = 'reddit';
            document.getElementById('reddit-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#ff4500');
            document.getElementById('app-title').innerText = "REDDIT FEED";
            feed.classList.add('tiktok-mode'); 
        } else if(val === 'x') {
            modoActual = 'x';
            document.getElementById('x-inputs').style.display = 'block';
            document.documentElement.style.setProperty('--accent', '#ffffff');
            document.getElementById('app-title').innerText = "X (TWITTER)";
        }
    }
    
    // Hide unused inputs
    document.querySelectorAll('.input-group').forEach(el => {
        if (modoActual === 'booru_generic' && el.id === 'r34-inputs') return; 
        if (el.id !== (modoActual === 'chan_catalog' ? 'chan-inputs' : modoActual + '-inputs')) el.style.display = 'none';
    });
}

function checkRedditInput() {
    const sel = document.getElementById('reddit-selector').value;
    const input = document.getElementById('reddit-custom');
    input.style.display = (sel === 'custom') ? 'block' : 'none';
}

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
    if (lower.includes("webp")) return "img";
    const clean = url.split("?")[0];
    const ext = clean.split(".").pop();
    if (["mp4", "webm", "m4v", "mov"].includes(ext)) return "vid";
    if (ext === "gif") return "gif";
    if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "img";
    if (lower.includes("preview") || lower.includes("image") || lower.includes("media")) return "img";
    return "img";
}

// --- NETWORK ENGINE ---
async function fetchSmart(targetUrl) {
    let lastError = null;
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
            if (txt.includes("Whoa there, pardner!") || txt.includes("Too Many Requests")) throw new Error("Bloqueo de Reddit");
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
        } catch (e) { lastError = e; continue; }
    }
    throw new Error(`Red falló. Último: ${lastError?.message}`);
}

function ejecutarBusqueda() {
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none';
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('centinela-scroll').style.display = 'none';
    
    paginaActual = 0; redditAfter = ''; hayMas = true; cargando = false;

    // MODIFIED: Now uses booru_generic
    if(modoActual === 'booru_generic' || modoActual === 'r34') {
        cargarPaginaBooru(0);
    }
    else if(modoActual === 'chan_catalog') cargarCatalogo4Chan();
    else if(modoActual === 'reddit') cargarPaginaReddit();
    else if(modoActual === 'x') cargarX();
}

// --- R34 ---
function sanitizeTag(tag) {
    if (!tag) return "";
    return tag.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
function buscarR34() { ejecutarBusqueda(); }

// --- GENERIC BOORU ENGINE (Hybrid) ---
function buscarR34() { ejecutarBusqueda(); } 

// IMPORTANT: Update ejecutarBusqueda() to call this function instead of the old one
// (See step D below)

async function cargarPaginaBooru(pageNum) {
    if (cargando) return; cargando = true;
    
    const site = BOORU_SITES[currentBooru];
    const tags = misTags.join(' ') || document.getElementById('input-tags-real').value.trim();
    let url = '';

    // 1. URL CONSTRUCTION ADAPTER
    if (site.adapter === 'ap_v3') {
        // Anime-Pictures uses 'search_tag' and 'page' (0-indexed)
        url = `${site.url}${site.endpoint}&page=${pageNum}&search_tag=${encodeURIComponent(tags)}`;
    } else {
        // Standard Rule34
        url = `${site.url}${site.endpoint}&limit=10&pid=${pageNum}&tags=${encodeURIComponent(tags)}`;
        if (site.key_needed) {
            const creds = getKeys(); 
            url += `&user_id=${creds.uid}&api_key=${creds.key}`;
        }
    }

    try {
        const rawData = await fetchSmart(url);
        let postsLimpios = [];

        // 2. DATA TRANSLATION ADAPTER
        if (site.adapter === 'ap_v3') {
            // Validation for Anime-Pictures
            if (!rawData.posts) throw new Error("Invalid API structure");
            
            postsLimpios = rawData.posts.map(p => {
                return {
                    // Fix relative URLs
                    file_url: p.file_url ? `https://anime-pictures.net${p.file_url}` : '',
                    preview_url: p.small_preview ? `https://anime-pictures.net${p.small_preview}` : '',
                    type: 'img', 
                    tags: "Tags complex (View on site)" // AP tags are complex objects, skipping for now
                };
            });
        } else {
            // Standard R34 is already clean
            postsLimpios = rawData;
        }

        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        
        if(!postsLimpios.length) { 
            hayMas=false; 
            document.getElementById('centinela-scroll').innerText="End of results."; 
            return; 
        }
        
        postsLimpios.forEach(item => {
            if(item.file_url) renderTarjetaR34(item);
        });
        
        paginaActual = pageNum;
        document.getElementById('centinela-scroll').innerText="...";
        
    } catch(e) { 
        document.getElementById('loading-status').innerText = `Error ${currentBooru}: ${e.message}`; 
    } finally { 
        cargando=false; 
    }
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
    let url = `https://www.reddit.com/r/${sub}/hot.json?limit=20`;
    if(redditAfter) url += `&after=${redditAfter}`;
    try {
        const data = await fetchSmart(url);
        if (!data || !data.data || !Array.isArray(data.data.children)) throw new Error("Reddit invalido");
        document.getElementById('loading-status').style.display = 'none';
        document.getElementById('centinela-scroll').style.display = 'flex';
        const posts = data.data.children;
        if(!posts.length) { hayMas=false; document.getElementById('centinela-scroll').innerText="Fin."; return; }
        redditAfter = data.data.after;
        for (let i = 0; i < posts.length; i++) processRedditPost(posts[i].data);
    } catch(e) { document.getElementById('loading-status').innerText = `Error: ${e.message}`; } finally { cargando=false; }
}
function processRedditPost(p) {
    if (p.is_self) return; 
    
    let src = p.url; // URL original (para descarga)
    let prev = p.thumbnail; // Empezamos con la mala por si acaso
    let type = detectType(src);

    // --- EL PUNTO MEDIO (SMART RESIZING) ---
    if (type === 'img') {
        // Verificamos si Reddit generó versiones redimensionadas
        if (p.preview?.images?.[0]?.resolutions?.length > 0) {
            
            // La lista 'resolutions' va de menor a mayor calidad.
            // Cogemos la ÚLTIMA de la lista.
            // Suele ser 640px, 960px o 1080px. Perfecta para móvil, ligera para datos.
            const versiones = p.preview.images[0].resolutions;
            const puntoMedio = versiones[versiones.length - 1];
            
            prev = puntoMedio.url.replace(/&amp;/g, '&');
            
        } else if (p.preview?.images?.[0]?.source) {
            // Si no hay intermedias, usamos la Source (HD pero pesada)
            prev = p.preview.images[0].source.url.replace(/&amp;/g, '&');
        } else {
            // Si todo falla, la URL cruda
            prev = src;
        }
    } 
    
    // Lógica de Video (Igual que antes, intentamos buscar carátula HD)
    else if (p.domain.includes('redgifs') || p.domain.includes('v.redd.it')) {
        const vid = p.preview?.reddit_video_preview?.fallback_url || p.secure_media?.reddit_video?.fallback_url;
        if (!vid) return;
        src = vid; 
        type = 'vid';
        
        // Para la "carátula" del video, también aplicamos la lógica del punto medio
        if (p.preview?.images?.[0]?.resolutions?.length > 0) {
            const versiones = p.preview.images[0].resolutions;
            prev = versiones[versiones.length - 1].url.replace(/&amp;/g, '&');
        } else if (p.preview?.images?.[0]?.source) {
            prev = p.preview.images[0].source.url.replace(/&amp;/g, '&');
        }
    }
    
    if (!prev || !prev.startsWith('http')) return; 
    if (type === 'img' && !src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return;
    
    renderCard(src, prev, type, p.title, `u/${p.author}`, 'reddit');
}
// --- 4CHAN (FULL SYSTEM) ---

// --- AUTOCOMPLETADO DINÁMICO 4CHAN (CUSTOM UI) ---

async function initChanAutocomplete() {
    // 1. Obtener lista (Caché o Red)
    // Igual que antes, pero sin llenar datalist
    const cached = localStorage.getItem('sys_chan_boards');
    
    // Intentamos actualizar en segundo plano siempre
    try {
        const data = await fetchSmart('https://a.4cdn.org/boards.json');
        if (data && data.boards) {
            const cleanList = data.boards.map(b => ({ c: b.board, n: b.title }));
            localStorage.setItem('sys_chan_boards', JSON.stringify(cleanList));
        }
    } catch (e) {
        console.warn("No se pudo actualizar boards.json:", e);
    }
    
    // 2. Activar el listener del Input
    setupChanInputListener();
}

function setupChanInputListener() {
    const inp = document.getElementById('chan-custom');
    const box = document.getElementById('chan-sugerencias');
    
    if (!inp || !box) return;

    inp.addEventListener('input', () => {
        const val = inp.value.toLowerCase().trim(); // Lo que escribes
        
        if (val.length < 1) {
            box.style.display = 'none';
            return;
        }

        // Recuperamos la lista de la memoria
        const rawList = localStorage.getItem('sys_chan_boards');
        if (!rawList) return;
        const list = JSON.parse(rawList);

        // --- FILTRO ESTRICTO POR CÓDIGO ---
        // Solo buscamos si el CÓDIGO (c) empieza por lo que escribiste.
        // Ignoramos el nombre (n).
        const matches = list.filter(b => b.c.toLowerCase().startsWith(val));

        renderChanSuggestions(matches, box, inp);
    });
    
    // Ocultar al hacer click fuera (básico)
    document.addEventListener('click', (e) => {
        if (e.target !== inp && e.target !== box) {
            box.style.display = 'none';
        }
    });
}

function renderChanSuggestions(list, box, inp) {
    box.innerHTML = '';
    
    if (list.length === 0) {
        box.style.display = 'none';
        return;
    }

    list.forEach(b => {
        const item = document.createElement('div');
        item.className = 'chan-suggestion-item';
        
        // Diseño: /g/ a la izquierda, "Technology" a la derecha en gris
        item.innerHTML = `<span class="chan-code">/${b.c}/</span> <span class="chan-name">${b.n}</span>`;
        
        item.onclick = () => {
            // Al hacer click, llenamos el input solo con el código limpio
            inp.value = b.c; 
            box.style.display = 'none';
            // Opcional: Cargar automáticamente al seleccionar
            // cargarCatalogo4Chan(); 
        };
        
        box.appendChild(item);
    });
    
    box.style.display = 'block';
}

// 1. FUNCIÓN UI: Mostrar/Ocultar input manual (Ponla junto a checkRedditInput)
function checkChanInput() {
    const sel = document.getElementById('board-selector').value;
    const input = document.getElementById('chan-custom');
    if (input) {
        input.style.display = (sel === 'custom') ? 'block' : 'none';
        if (sel === 'custom') input.focus();
    }
}

// 2. FUNCIÓN DE CARGA ACTUALIZADA
async function cargarCatalogo4Chan() {
    modoActual = 'chan_catalog';
    
    // 1. OBTENER TABLÓN
    let selectedBoard = document.getElementById('board-selector').value;
    
    // Si es custom, leemos del input y limpiamos barras por si el usuario las puso
    if (selectedBoard === 'custom') {
        const customVal = document.getElementById('chan-custom').value.trim();
        // Esto permite que el usuario escriba "v" o "/v/" y funcione igual
        selectedBoard = customVal.replace(/\//g, '').toLowerCase();
    }

    if (!selectedBoard) {
        alert("Escribe un nombre de tablón.");
        return;
    }

    boardActual = selectedBoard; 
    
    // 2. ACTUALIZAR INTERFAZ
    ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none'; 
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('feed-infinito').classList.remove('tiktok-mode');

    // --- FIX VISUAL: ACTUALIZAR EL TÍTULO DE LA APP ---
    // Ahora sabrás siempre en qué tablón estás mirando
    document.getElementById('app-title').innerText = `4CHAN /${boardActual}/`;
    // --------------------------------------------------

    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('loading-status').innerText = `Cargando /${boardActual}/...`;
    document.getElementById('centinela-scroll').style.display = 'none'; 
    
    setupDropdown('catalog');

    // 3. PETICIÓN DE RED
    const url = `https://a.4cdn.org/${boardActual}/catalog.json`;
    try {
        const pages = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        catalogCache = [];
        pages.forEach(p => { if(p.threads) catalogCache.push(...p.threads); });
        
        if (catalogCache.length === 0) throw new Error("Vacío");
        
        renderCatalogoOrdenado(); 
    } catch (e) { 
        document.getElementById('loading-status').innerText = "Error 4Chan: " + e.message; 
        document.getElementById('app-title').innerText = "4CHAN ERROR"; // Feedback visual
    }
}

function setupDropdown(context) {
    const sortEl = document.getElementById('chan-sort');
    const mainBtn = document.getElementById('btn-chan-main');
    if (!sortEl || !mainBtn) return;
    
    sortEl.innerHTML = ''; 

    if (context === 'catalog') {
        // MODO CATALOGO
        mainBtn.style.display = 'block'; 
        mainBtn.innerText = "CARGAR TABLÓN";
        mainBtn.onclick = cargarCatalogo4Chan;
        
        const opts = [{v:'bump', t:'🔥 Activos'}, {v:'img', t:'🖼️ Más Img'}, {v:'new', t:'✨ Nuevos'}];
        opts.forEach(o => sortEl.add(new Option(o.t, o.v)));
        sortEl.onchange = () => { renderCatalogoOrdenado(); };
        
    } else if (context === 'thread') {
        // MODO HILO (BOTÓN OCULTO)
        mainBtn.style.display = 'none'; 

        const opts = [{v:'all', t:'👁️ Ver Todo'}, {v:'vid', t:'🎬 Solo Videos'}, {v:'gif', t:'👾 Solo GIFs'}, {v:'img', t:'📷 Solo JPG/PNG'}];
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
    const titleRaw = t.sub || t.com || "Sin descripción";
    const cleanDesc = titleRaw.replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 150);
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
    
    // --- ACTIVAR MODO TIKTOK ---
    const feed = document.getElementById('feed-infinito');
    feed.innerHTML = '';
    feed.classList.add('tiktok-mode'); // <--- AQUÍ ACTIVAMOS LA VISTA DE SWIPE
    // ---------------------------

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
            
            // Si el modo es SOLO MEDIA y no hay archivo, saltamos
            if (viewMode === 'media' && !hasMedia) return; 
            
            // Si el modo es ALL y es solo texto, también lo mostramos (como tarjeta de texto)
            
            renderChanPost(p, hasMedia, viewMode);
            count++;
        });

        if(count===0) document.getElementById('loading-status').innerText = "Hilo vacío o filtrado.";
        
    } catch(e) { document.getElementById('loading-status').innerText = "Hilo muerto (404)."; }
}

function renderChanPost(p, hasMedia, viewMode) {
    let type = 'text', src = '', prev = '', badgeHtml = '', fileInfo = '';
    
    // 1. PREPARAR MEDIA
    if (hasMedia) {
        src = `https://i.4cdn.org/${boardActual}/${p.tim}${p.ext}`;
        prev = `https://i.4cdn.org/${boardActual}/${p.tim}s.jpg`;
        type = detectType(src);
        
        if(type === 'vid') badgeHtml = `<span class="badge bg-vid">VID</span>`;
        else if(type === 'gif') badgeHtml = `<span class="badge bg-gif">GIF</span>`;
        else badgeHtml = `<span class="badge bg-img">IMG</span>`;
        
        let cleanName = p.filename.length > 15 ? p.filename.substring(0,15)+'...' : p.filename;
        fileInfo = `<span style="font-family:monospace; font-size:0.75rem; color:#aaa; margin-left:5px;">${cleanName}${p.ext}</span>`;
    } else {
        // Si es solo texto
        type = 'text';
        badgeHtml = `<span class="badge" style="background:#333;">TXT</span>`;
    }

    // 2. PREPARAR COMENTARIO (Para footer y drawer)
    let rawCom = p.com || "";
    // Limpieza básica de HTML de 4chan para que se vea decente
    // Reemplazamos <br> por saltos de línea visuales
    let cleanComFull = rawCom.replace(/<wbr>/g, ''); 
    
    // Previa para el footer (sin HTML tags molestos)
    let cleanComPreview = rawCom.replace(/<br>/g, ' ').replace(/(<([^>]+)>)/gi, "").substring(0, 60);
    if(cleanComPreview.length >= 60) cleanComPreview += "...";
    if(!cleanComPreview) cleanComPreview = "Sin comentario";

    const card = document.createElement('div'); 
    card.className = 'tarjeta chan-post-item';
    card.dataset.filetype = type; 

    // 3. GENERAR HTML (Estructura TikTok)
    let mediaEl = '';
    
    if (hasMedia) {
        if(type==='vid') {
            mediaEl=`<div class="media-wrapper"><video class="media-content" controls loop playsinline preload="none" poster="${prev}"><source src="${src}" type="video/mp4"><source src="${src}" type="video/webm"></video><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
        } else if(type==='gif') {
            mediaEl=`<div class="media-wrapper" onclick="alternarGif(this,'${src}','${prev}')"><img class="media-content" src="${prev}" loading="lazy"><div class="overlay-btn">GIF</div><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
        } else {
            mediaEl=`<div class="media-wrapper"><img class="media-content" src="${prev}" loading="lazy" onclick="abrirLightbox('${src}','img')"><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
        }
    } else {
        // Tarjeta SOLO TEXTO (Centrada y elegante)
        mediaEl = `<div class="media-wrapper" style="align-items:center; padding:20px; box-sizing:border-box;">
            <div style="color:#ddd; font-size:1.1rem; text-align:center; line-height:1.5;">
                "${cleanComPreview}"
            </div>
        </div>`;
    }

    // 4. FOOTER & DRAWER (Reutilizamos la lógica de R34)
    // Usamos 'toggleTags' para abrir el comentario completo
    let footerHtml = `
        <div class="meta-footer">
            <div style="display:flex; gap:10px; align-items:center;">
                ${badgeHtml} 
                <span class="badge bg-chan">#${p.no}</span>
                ${fileInfo}
            </div>
            
            <div class="meta-desc-preview" onclick="toggleTags(this)">
                ${cleanComPreview} <span class="ver-mas">Leer más</span>
            </div>
        </div>

        <div class="tags-drawer">
            <div class="drawer-close-x" onclick="toggleTags(this)">✕</div>
            <h3 style="color:#fff; margin: 0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333; padding-bottom:10px;">
                Comentario #${p.no}
            </h3>
            
            <div class="drawer-tags-container" style="display:block; padding: 20px 20px 80px 20px;">
                <div style="color:#ddd; font-size:1rem; line-height:1.5; white-space:pre-wrap;">${rawCom}</div>
            </div>
        </div>
    `;

    card.innerHTML = mediaEl + footerHtml; 
    
    if(type==='vid') videoObserver.observe(card.querySelector('video'));
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
    
    // --- DESACTIVAR MODO TIKTOK ---
    feed.classList.remove('tiktok-mode'); // <--- VOLVEMOS A LA REJILLA NORMAL
    // ------------------------------

    if (catalogCache && catalogCache.length > 0) { renderCatalogoOrdenado(); restoreCatalogScroll(); return; }
    cargarCatalogo4Chan().then(() => { restoreCatalogScroll(); });
}

// --- X (NITTER) ---
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
        if(items.length===0){ document.getElementById('loading-status').innerText="Sin resultados."; return; }
        items.forEach(item => {
            const desc = item.querySelector('description').textContent;
            const img = desc.match(/src="([^"]+)"/);
            if(img) { renderCard(img[1], img[1], 'img', item.querySelector('title').textContent, 'X', 'x'); }
        });
    } catch(e) { document.getElementById('loading-status').innerText = e.message; }
}

// --- RENDER GENERICO ACTUALIZADO ---
// --- RENDER GENERICO (UNIVERSAL TIKTOK STYLE) ---
function renderCard(src, prev, type, tags, badgeTxt, context) {
    const card = document.createElement('div'); card.className='tarjeta';
    
    // --- 1. MEDIA (Igual que antes) ---
    let media='', badge='';
    if(type==='vid') {
        badge=`<span class="badge bg-vid">VID</span>`;
        media=`<div class="media-wrapper"><video class="media-content" controls loop playsinline muted preload="metadata" poster="${prev}"><source src="${src}" type="video/mp4"><source src="${src}" type="video/webm"></video><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else if(type==='gif') {
        badge=`<span class="badge bg-gif">GIF</span>`;
        media=`<div class="media-wrapper" onclick="alternarGif(this,'${src}','${prev}')"><img class="media-content" src="${prev}" loading="lazy"><div class="overlay-btn">GIF</div><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    } else {
        badge=`<span class="badge bg-img">IMG</span>`;
        media=`<div class="media-wrapper"><img class="media-content" src="${prev}" loading="lazy" onclick="abrirLightbox('${src}','img')"><div class="btn-download" onclick="descargar('${src}')">⬇</div></div>`;
    }

    // --- 2. LOGICA DE FOOTER Y DRAWER (Aquí está el cambio) ---
    let footerHtml = '';
    
    // Aplicamos estilo TikTok a R34, Boorus Y AHORA REDDIT
    if(context === 'r34' || context === 'booru_generic' || context === 'reddit') {
        
        let previewText = "";
        let drawerContent = "";
        let sourceBadge = "";
        let drawerTitle = "";

        if (context === 'reddit') {
            // --- LOGICA ESPECIFICA REDDIT ---
            sourceBadge = `<span class="badge bg-reddit">REDDIT</span> <span class="badge" style="background:#333; font-size:0.6rem;">${badgeTxt}</span>`; // badgeTxt trae el autor 'u/user'
            
            // El "tag" en Reddit es el TÍTULO del post
            const title = tags; 
            previewText = title.length > 60 ? title.substring(0, 60) + "..." : title;
            
            // En el drawer mostramos el título completo como texto, no como chips
            drawerTitle = "Título Completo";
            drawerContent = `<div style="color:#ddd; font-size:1.1rem; line-height:1.5; padding:10px;">${title}</div>`;
            
        } else {
            // --- LOGICA RULE34/BOORU ---
            sourceBadge = `<span class="badge" style="background:#3b82f6;">R34</span>`;
            
            // "tags" es una cadena de etiquetas separadas por espacios
            const tagsArray = tags.split(' ').filter(t => t.length > 0);
            const shortTagsStr = tagsArray.slice(0, 5).join(', ');
            const remaining = tagsArray.length - 5;
            
            previewText = `${shortTagsStr}... <span class="ver-mas">${remaining > 0 ? '+'+remaining : ''}</span>`;
            drawerTitle = "Etiquetas";
            drawerContent = `<div class="drawer-tags-container">${generarTagsHtml(tags)}</div>`;
        }

        footerHtml = `
            <div class="meta-footer">
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                    ${badge} ${sourceBadge}
                </div>
                <div class="meta-desc-preview" onclick="toggleTags(this)" style="margin-top:5px;">
                    ${previewText}
                </div>
            </div>

            <div class="tags-drawer">
                <div class="drawer-close-x" onclick="toggleTags(this)">✕</div>
                <h3 style="color:#fff; margin: 0 0 10px 0; font-size:1.1rem; border-bottom:1px solid #333; padding-bottom:10px;">
                    ${drawerTitle}
                </h3>
                ${drawerContent}
            </div>
        `;
    } else {
        // Fallback para X (Twitter) u otros modos futuros
        if(badgeTxt) badge += ` <span class="badge bg-x">${badgeTxt}</span>`;
        footerHtml = `<div class="meta-footer">${badge} <span style="font-size:0.7rem;color:#aaa; margin-left:10px;">${tags.substring(0,50)}...</span></div>`;
    }

    card.innerHTML = media + footerHtml;
    if(type==='vid') videoObserver.observe(card.querySelector('video'));
    document.getElementById('feed-infinito').appendChild(card);
}
// LISTA DE PROXIES EXCLUSIVA PARA DESCARGAS (Binary friendly)
const DOWNLOAD_PROXIES = [
    'https://corsproxy.io/?',                    // Opción A: Rápida
    'https://api.allorigins.win/raw?url=',       // Opción B: Fiable
    'https://api.codetabs.com/v1/proxy/?quest='  // Opción C: Backup
];

async function descargar(u) { 
    const btn = event.currentTarget; 
    const iconOriginal = btn.innerText;
    
    // Feedback visual: Si es video, avisamos que puede tardar
    const esVideo = u.match(/\.(mp4|webm|mov)$/i);
    btn.innerText = esVideo ? "🎞️" : "⏳"; 
    
    // Evitamos pulsaciones dobles
    if(btn.disabled) return;
    btn.disabled = true;

    let downloadSuccess = false;

    // INTENTO DE DESCARGA ESCALONADA
    for (let proxyBase of DOWNLOAD_PROXIES) {
        try {
            console.log(`Intentando descarga con: ${proxyBase}`);
            
            // Construimos la URL del proxy
            // Nota: allorigins y codetabs necesitan la URL tal cual, corsproxy la necesita encodeada a veces, 
            // pero encodeURIComponent suele ser seguro para todos en la query string.
            const target = proxyBase + encodeURIComponent(u);
            
            const response = await fetch(target);
            if(!response.ok) throw new Error(`Error HTTP ${response.status}`);
            
            const blob = await response.blob(); 
            
            // Si el blob está vacío o corrupto, pasamos al siguiente
            if (blob.size < 100) throw new Error("Archivo vacío o corrupto");

            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            
            // Nombre del archivo limpio
            const cleanName = u.split('/').pop().split('?')[0] || `descarga_${Date.now()}`;
            a.download = cleanName;
            
            document.body.appendChild(a);
            a.click();
            
            // Limpieza
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            }, 100);
            
            downloadSuccess = true;
            break; // ¡ÉXITO! Salimos del bucle
            
        } catch (e) {
            console.warn(`Fallo proxy descarga (${proxyBase}):`, e.message);
            // Continuamos al siguiente proxy del bucle...
        }
    }

    btn.disabled = false;

    if (downloadSuccess) {
        btn.innerText = "✅"; 
        setTimeout(() => btn.innerText = iconOriginal, 2000);
    } else {
        console.error("Todos los proxies de descarga fallaron.");
        btn.innerText = "⚠️"; 
        
        // ULTIMO RECURSO: Abrir pestaña
        // Le damos un pequeño delay para que el usuario vea el icono de error
        setTimeout(() => {
            // Confirmación opcional para no asustar al usuario
            if(confirm("No se pudo descargar directamente (archivo muy pesado o bloqueado). ¿Abrir en nueva pestaña para guardar?")) {
                window.open(u, '_blank');
            }
            btn.innerText = iconOriginal;
        }, 500);
    }
}
function alternarGif(w,g,p) { const i=w.querySelector('img'); if(w.classList.contains('playing')){i.src=p;w.classList.remove('playing');}else{i.src=g;w.classList.add('playing');} }

//NUEVA FUNCIÓN TOGGLE TAGS (Para abrir/cerrar el telón)

function toggleTags(el) { 
    // Buscamos la tarjeta padre de donde se hizo click
    const card = el.closest('.tarjeta');
    // Dentro de esa tarjeta, buscamos el telón (drawer)
    const drawer = card.querySelector('.tags-drawer');

    if(drawer.classList.contains('open')){
        // Si está abierto, lo cerramos
        drawer.classList.remove('open');
    } else {
        // Si está cerrado, lo abrimos
        drawer.classList.add('open');
    }
}
function generarTagsHtml(t) { return t.split(' ').map(tag=>tag?`<span class="tag-chip" style="font-size:0.7rem;margin:2px" onclick="abrirModal('${tag}')">${tag}</span>`:'').join(''); }
function restoreCatalogScroll() { requestAnimationFrame(() => { requestAnimationFrame(() => { window.scrollTo(0, scrollCatalogPos); }); }); }
function cargarSiguientePagina() { 
    document.getElementById('centinela-scroll').innerText="Loading..."; 
    // MODIFIED: Now calls cargarPaginaBooru
    if(modoActual === 'booru_generic' || modoActual === 'r34') cargarPaginaBooru(paginaActual+1); 
    if(modoActual === 'reddit') cargarPaginaReddit(); 
}
// --- LIGHTBOX AVANZADO (ZOOM, PINCH & PAN) ---
const lb = document.getElementById('lightbox');
const lbLayer = document.getElementById('lightbox-transform-layer');

// Estado del sistema de gestos
let state = {
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0,
    pinchDist: 0
};

function abrirLightbox(u, t) {
    lb.style.display = 'flex';
    resetZoom();
    lbLayer.innerHTML = '';
    
    if (t === 'vid') {
        lbLayer.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;max-height:100%; box-shadow:0 0 50px rgba(0,0,0,0.5)"></video>`;
    } else {
        const img = document.createElement('img');
        img.src = u;
        img.id = 'lightbox-img';
        img.draggable = false;
        img.style.cssText = "max-width:100%; max-height:100%; object-fit:contain; pointer-events:auto; touch-action:none;";
        lbLayer.appendChild(img);
        initGestures(img);
    }
}

function cerrarLightbox() {
    const v = lbLayer.querySelector('video');
    if (v) { try { v.pause(); v.src=""; } catch(_){} }
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

// --- MOTOR DE GESTOS (TOUCH & MOUSE) ---
function initGestures(target) {
    let lastTap = 0;
    
    // 1. DOBLE TAP (Zoom Escalonado)
    target.addEventListener('click', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            stepZoom();
        }
        lastTap = now;
    });

    // 2. TOUCH START
    lb.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            state.panning = false;
            state.pinchDist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
        } else if (e.touches.length === 1) {
            if (state.scale > 1) { 
                state.panning = true;
                state.startX = e.touches[0].clientX - state.pointX;
                state.startY = e.touches[0].clientY - state.pointY;
            }
        }
    }, {passive: false});

    // 3. TOUCH MOVE
    lb.addEventListener('touchmove', (e) => {
        e.preventDefault(); 

        if (e.touches.length === 2) {
            // PINCH
            const newDist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            
            if (state.pinchDist > 0) {
                const diff = newDist / state.pinchDist;
                state.scale = Math.min(Math.max(1, state.scale * diff), 10); 
                updateTransform();
                state.pinchDist = newDist; 
            }
            
        } else if (e.touches.length === 1 && state.panning && state.scale > 1) {
            // PAN
            state.pointX = e.touches[0].clientX - state.startX;
            state.pointY = e.touches[0].clientY - state.startY;
            
            const limitX = (window.innerWidth * state.scale - window.innerWidth) / 2;
            const limitY = (window.innerHeight * state.scale - window.innerHeight) / 2;
            
            if(state.pointX > limitX + 100) state.pointX = limitX + 100;
            if(state.pointX < -limitX - 100) state.pointX = -limitX - 100;
            if(state.pointY > limitY + 100) state.pointY = limitY + 100;
            if(state.pointY < -limitY - 100) state.pointY = -limitY - 100;

            updateTransform();
        }
    }, {passive: false});

    // 4. TOUCH END
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

// Observers
const videoObserver = new IntersectionObserver((entries, obs) => { entries.forEach(entry => { const video = entry.target; if (entry.isIntersecting) { video.preload = 'metadata'; const onLoaded = () => { obs.unobserve(video); video.removeEventListener('loadedmetadata', onLoaded); }; video.addEventListener('loadedmetadata', onLoaded); } }); }, { rootMargin: '300px' });
const scrollObserver=new IntersectionObserver((es)=>{if(es[0].isIntersecting && !cargando && hayMas && (modoActual==='r34'||modoActual==='reddit')) cargarSiguientePagina();},{rootMargin:'300px'});
scrollObserver.observe(document.getElementById('centinela-scroll'));

// Auto-Suggest
const inp = document.getElementById('input-tags-real'); const rBox = document.getElementById('sugerencias-box');
inp.addEventListener('input', (e) => { const val = inp.value; if (val.trim().length < 2) { rBox.style.display = 'none'; return; } clearTimeout(timerDebounce); timerDebounce = setTimeout(async () => { try { const query = val.trim().replace(/ /g, '_'); const d = await fetchSmart(`https://api.rule34.xxx/autocomplete.php?q=${query}`); mostrarSugerenciasR34(d); } catch (e) {} }, 300); });
function mostrarSugerenciasR34(l) { rBox.innerHTML = ''; if (!l || !l.length) { rBox.style.display = 'none'; return; } l.slice(0, 8).forEach(i => { const d = document.createElement('div'); d.className = 'sugerencia-item'; const v = i.value || i; const label = i.label || ''; const count = label.includes('(') ? label.split('(')[1].replace(')', '') : ''; d.innerHTML = `<span>${v}</span><span style="color:#666; font-size:0.8rem">${count}</span>`; d.onclick = () => { agregarTag(v); inp.value = ''; rBox.style.display = 'none'; inp.focus(); }; rBox.appendChild(d); }); rBox.style.display = 'block'; }
inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const textoFinal = inp.value.trim(); if (textoFinal) { agregarTag(textoFinal.replace(/ /g, '_')); inp.value = ''; rBox.style.display = 'none'; } } if (e.key === 'Backspace' && !inp.value) { misTags.pop(); renderChips(); } });
function agregarTag(t) { if (!misTags.includes(t)) { misTags.push(t); renderChips(); } }
function renderChips() { const c = document.getElementById('lista-chips'); c.innerHTML = ''; misTags.forEach((t, i) => { const el = document.createElement('div'); el.className = 'tag-chip'; el.innerText = t; el.onclick = () => { misTags.splice(i, 1); renderChips(); }; c.appendChild(el); }); }

// Modal Tags
function abrirModal(tag) { const modal = document.getElementById('modal-tag-options'); document.getElementById('modal-tag-name').innerText = tag; tagSeleccionadoTemp = tag; modal.style.display = 'flex'; }
function cerrarModal(e) { const modal = document.getElementById('modal-tag-options'); if (!e || e.target === modal) { modal.style.display = 'none'; } }
function accionTag(mode) { 
    if (mode === 'add') { 
        agregarTag(tagSeleccionadoTemp); 
        cerrarModal(null); 
        setTimeout(() => { cargando = false; buscarR34(); }, 50);
        return; 
    } 
    if (mode === 'new') { 
        misTags = [tagSeleccionadoTemp]; 
        renderChips(); 
        cerrarModal(null); 
        setTimeout(() => { cargando = false; buscarR34(); }, 50);
        return; 
    } 
}

// INIT - RECUPERACIÓN DE SESIÓN
window.onload = function() {
    initDebugSystem();
    
    // --- NUEVO: INICIAR AUTOCOMPLETADO 4CHAN ---
    initChanAutocomplete(); 
    // -------------------------------------------
    
    // Limpieza
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'none';

    // Recuperar
    const lastMode = localStorage.getItem('sys_last_mode') || 'r34';
    const sel = document.getElementById('source-selector');
    if(sel) sel.value = lastMode;
    
    cambiarModo(); 

    if (lastMode === '4chan') {
        const btnChan = document.getElementById('btn-chan-main');
        if (btnChan) btnChan.onclick = cargarCatalogo4Chan;
        setTimeout(cargarCatalogo4Chan, 100); 
    }
    
    try { if(!SYS_PASS) console.error("Drivers.js no cargado!"); } catch(e){}
};
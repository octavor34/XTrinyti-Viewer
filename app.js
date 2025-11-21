// --- SISTEMA DE DEBUG MEJORADO (NUEVO) ---
let debugEnabled = localStorage.getItem('sys_debug_mode') === 'true';

function initDebugSystem() {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        consoleDiv.style.display = debugEnabled ? 'block' : 'none';
    }
    updateDebugButtonUI();
}

function toggleDebugMode() {
    debugEnabled = !debugEnabled;
    localStorage.setItem('sys_debug_mode', debugEnabled);
    
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.style.display = debugEnabled ? 'block' : 'none';
    
    updateDebugButtonUI();
    
    if(debugEnabled) logDebug("Sistema de depuración: ACTIVADO");
}

function updateDebugButtonUI() {
    const btn = document.getElementById('btn-toggle-debug');
    if (!btn) return;
    
    if (debugEnabled) {
        btn.innerHTML = "✅ DEBUG ACTIVO";
        btn.style.background = "#064e3b"; 
        btn.style.borderColor = "#34d399";
        btn.style.color = "#fff";
    } else {
        btn.innerHTML = "🐞 ACTIVAR DEBUG";
        btn.style.background = "#222";
        btn.style.borderColor = "#444";
        btn.style.color = "#888";
    }
}

window.onerror = function(msg, url, line) {
    logDebug(`CRITICAL ERROR: ${msg} @ L${line}`);
};

function logDebug(message) {
    let consoleDiv = document.getElementById('debug-console');
    if (!consoleDiv) return;

    const timestamp = new Date().toISOString().substr(11, 8); 
    consoleDiv.insertAdjacentHTML('beforeend', `<div style="border-bottom:1px solid #220000; padding:2px;">
        <span style="color:#555">[${timestamp}]</span> ${message}
    </div>`);
    
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function clearDebugLog() {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.innerHTML = '<div style="color:#444">--- Log Limpiado ---</div>';
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

// --- ADMIN SYSTEM (LÓGICA DEL CANDADO) ---
function abrirAdminLogin() {
    console.log("Intentando abrir login admin...");
    const panel = document.getElementById('panel-admin');
    
    // Si el panel ya está abierto, lo cerramos (toggle)
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }
    
    // Si no, mostramos el modal de contraseña
    const modal = document.getElementById('modal-admin-login');
    if(modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            const inp = document.getElementById('admin-pass-input');
            if(inp) inp.focus();
        }, 100);
    } else {
        alert("Error: Modal de login no encontrado en HTML");
    }
}

function checkAdminPass() {
    const input = document.getElementById('admin-pass-input');
    const val = input.value;
    
    // SYS_PASS viene de drivers.js
    if (val === SYS_PASS) {
        document.getElementById('modal-admin-login').style.display = 'none';
        document.getElementById('panel-admin').style.display = 'block';
        input.value = ''; 
        logDebug("Acceso Admin concedido.");
    } else {
        alert("ACCESO DENEGADO");
        input.value = '';
        logDebug("Intento fallido de acceso admin.");
    }
}

function cerrarAdminPanel() {
    document.getElementById('panel-admin').style.display = 'none';
}

// --- CAMBIO DE MODOS ---
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

    // Lógica 4Chan
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

    if(modoActual === 'r34') cargarPaginaR34(0);
    else if(modoActual === 'chan_catalog') cargarCatalogo4Chan();
    else if(modoActual === 'reddit') cargarPaginaReddit();
    else if(modoActual === 'x') cargarX();
}

// --- R34 (CON LLAVES CIFRADAS) ---
function sanitizeTag(tag) {
    if (!tag) return "";
    return tag.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
function buscarR34() { ejecutarBusqueda(); }

async function cargarPaginaR34(pageNum) {
    if (cargando) return; cargando = true;
    const tags = misTags.join(' ') || document.getElementById('input-tags-real').value.trim();
    
    // DESENCRIPTADO AL VUELO
    const creds = getKeys(); // De drivers.js
    const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=10&pid=${pageNum}&tags=${encodeURIComponent(tags)}&user_id=${creds.uid}&api_key=${creds.key}`;

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
    if (cargando) return;
    cargando = true;
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
    } catch(e) {
        document.getElementById('loading-status').innerText = `Error: ${e.message}`;
    } finally { cargando=false; }
}
function processRedditPost(p) {
    if(p.is_self) return;
    if (!p.thumbnail || p.thumbnail === 'self' || p.thumbnail === 'default' || p.thumbnail === 'nsfw') {
        if(!p.preview?.images) return; 
    }    
    let src = p.url; let prev = p.thumbnail; let type = detectType(src);
    if (p.domain.includes('redgifs') || p.domain.includes('v.redd.it')) {
        const vid = p.preview?.reddit_video_preview?.fallback_url || p.secure_media?.reddit_video?.fallback_url;
        if (!vid) return;
        src = vid; type = 'vid';
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

    const url = `https://a.4cdn.org/${boardActual}/catalog.json`;
    try {
        const pages = await fetchSmart(url);
        document.getElementById('loading-status').style.display = 'none';
        catalogCache = [];
        pages.forEach(p => { if(p.threads) catalogCache.push(...p.threads); });
        renderCatalogoOrdenado();
    } catch (e) { document.getElementById('loading-status').innerText = "Error 4Chan: " + e.message; }
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
    threads.forEach(renderHilo4Chan);
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
    scrollCatalogPos = window.scrollY;
    modoActual = 'chan_thread';
    ocultarPanel();
    document.getElementById('feed-infinito').innerHTML = '';
    document.getElementById('loading-status').style.display = 'block';
    document.getElementById('nav-chan').style.display = 'block';
    const url = `https://a.4cdn.org/${boardActual}/thread/${threadId}.json`;
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

function descargar(u) { window.open(u, '_blank'); }
function alternarGif(w,g,p) { const i=w.querySelector('img'); if(w.classList.contains('playing')){i.src=p;w.classList.remove('playing');}else{i.src=g;w.classList.add('playing');} }
function toggleTags(el) { 
    const d = el.closest('.meta-footer').nextElementSibling; 
    if(d.classList.contains('open')){d.classList.remove('open');el.innerText="Ver Etiquetas";}else{d.classList.add('open');el.innerText="Ocultar";} 
}
function generarTagsHtml(t) { return t.split(' ').map(tag=>tag?`<span class="tag-chip" style="font-size:0.7rem;margin:2px" onclick="abrirModal('${tag}')">${tag}</span>`:'').join(''); }
function restoreCatalogScroll() { requestAnimationFrame(() => { requestAnimationFrame(() => { window.scrollTo(0, scrollCatalogPos); }); }); }
function volverCatalogo() {
    modoActual = 'chan_catalog'; chanCursor = 0; isInThread = false; ocultarPanel();
    document.getElementById('nav-chan').style.display = 'none'; 
    document.getElementById('feed-infinito').innerHTML = '';
    if (catalogCache && catalogCache.length > 0) { renderCatalogoOrdenado(); restoreCatalogScroll(); return; }
    cargarCatalogo4Chan().then(() => { restoreCatalogScroll(); });
}
function cargarSiguientePagina() { document.getElementById('centinela-scroll').innerText="Cargando..."; if(modoActual==='r34')cargarPaginaR34(paginaActual+1); if(modoActual==='reddit')cargarPaginaReddit(); }

// Lightbox
const lb = document.getElementById('lightbox');
const lbLayer = document.getElementById('lightbox-transform-layer');
let zoom = { s: 1, x: 0, y: 0 }; let gesturesInitialized = false; let lastTapTime = 0; let pointerActive = false;
function abrirLightbox(u, t) {
    lb.style.display = 'flex'; resetZoom();
    if (t === 'vid') { lbLayer.innerHTML = `<video src="${u}" controls autoplay style="max-width:100%;max-height:100%"></video>`; } 
    else { lbLayer.innerHTML = `<img id="lightbox-img" src="${u}" draggable="false">`; initGestures(); }
}
function cerrarLightbox() { const v = lbLayer.querySelector('video'); if (v && typeof v.pause === 'function') try { v.pause(); } catch (_) {} lb.style.display = 'none'; lbLayer.innerHTML = ''; resetZoom(); }
function resetZoom() { zoom = { s: 1, x: 0, y: 0 }; updateZoom(); }
function updateZoom() { lbLayer.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`; }
function initGestures() {
    if (gesturesInitialized) return; gesturesInitialized = true;
    lbLayer.addEventListener('click', (e) => { const img = e.target && e.target.id === 'lightbox-img' ? e.target : null; if (!img) return; const now = Date.now(); if (now - lastTapTime < 300) { e.preventDefault(); toggleZoom(); } lastTapTime = now; });
    lb.addEventListener('touchstart', startDrag, { passive: false }); lb.addEventListener('touchmove', drag, { passive: false }); lb.addEventListener('touchend', endDrag);
    lb.addEventListener('mousedown', (e) => { if (zoom.s === 1) return; pointerActive = true; startDrag(e); });
    window.addEventListener('mousemove', (e) => { if (!pointerActive) return; drag(e); });
    window.addEventListener('mouseup', (e) => { if (!pointerActive) return; pointerActive = false; endDrag(e); });
}
function toggleZoom() { if (zoom.s > 1) { resetZoom(); } else { zoom.s = 2.5; updateZoom(); } }
function startDrag(e) { const tgt = e.target || e.srcElement; if (tgt && tgt.closest && tgt.closest('.lb-btn')) return; if (zoom.s === 1) return; if (e.type === 'touchstart') e.preventDefault(); zoom.panning = true; const point = (e.touches && e.touches[0]) ? e.touches[0] : e; zoom.startX = point.clientX - zoom.x; zoom.startY = point.clientY - zoom.y; lbLayer.style.transition = 'none'; }
function drag(e) { if (!zoom.panning) return; if (e.type === 'touchmove') e.preventDefault(); const point = (e.touches && e.touches[0]) ? e.touches[0] : e; zoom.x = point.clientX - zoom.startX; zoom.y = point.clientY - zoom.startY; const maxOffset = 3000; zoom.x = Math.max(-maxOffset, Math.min(maxOffset, zoom.x)); zoom.y = Math.max(-maxOffset, Math.min(maxOffset, zoom.y)); updateZoom(); }
function endDrag() { zoom.panning = false; lbLayer.style.transition = 'transform 0.2s ease-out'; if (zoom.s < 1) { resetZoom(); } }

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
        // 1. Añadimos el tag a la lista interna y visual
        agregarTag(tagSeleccionadoTemp);
        
        // 2. Cerramos el modal
        cerrarModal(null);
        
        // 3. FORZAMOS la búsqueda
        // Usamos setTimeout para asegurar que el motor de JS actualizó el array misTags antes de leerlo
        setTimeout(() => {
            console.log("Disparando búsqueda automática tras añadir tag...");
            // Forzamos estado 'no cargando' para asegurar que la petición salga
            cargando = false; 
            buscarR34(); 
        }, 50); // 50ms de respiro para el navegador
        
        return;
    }

    if (mode === 'new') {
        // Borramos tags anteriores y dejamos solo este
        misTags = [tagSeleccionadoTemp];
        renderChips();
        
        cerrarModal(null);
        
        setTimeout(() => {
            cargando = false;
            buscarR34();
        }, 50);
        return;
    }
}
// INIT
window.onload = function() {
    initDebugSystem();
    document.getElementById('r34-inputs').style.display = 'block';
    // Test simple para ver si drivers.js cargó
    try { if(!SYS_PASS) console.error("Drivers.js no cargado!"); } catch(e){}
};
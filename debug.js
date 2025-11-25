// debug.js - SISTEMA FANTASMA (CORREGIDO)
window.debugEnabled = true; 

// 1. DEFINIR FUNCIONES PRIMERO (Para que existan cuando las llamemos)
window.abrirAdminLogin = function() {
    const panel = document.getElementById('panel-admin');
    if (panel && panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }
    const modal = document.getElementById('modal-admin-login');
    if(modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            const inp = document.getElementById('admin-pass-input');
            if(inp) inp.focus();
        }, 100);
    }
};

window.checkAdminPass = function() {
    const input = document.getElementById('admin-pass-input');
    const msg = document.getElementById('login-msg');
    
    // SYS_PASS viene de drivers.js
    const passReal = (typeof SYS_PASS !== 'undefined') ? SYS_PASS : "admin123";
    
    if (input.value === passReal) {
        document.getElementById('modal-admin-login').style.display = 'none';
        document.getElementById('panel-admin').style.display = 'block';
        input.value = '';
        msg.style.display = 'none';
        logDebug("Acceso Admin concedido.");
    } else {
        msg.style.display = 'block';
        input.value = '';
        input.focus();
    }
};

window.cerrarAdminPanel = function() {
    const p = document.getElementById('panel-admin');
    if(p) p.style.display = 'none';
};

window.logDebug = function(message) {
    if (!window.debugEnabled) return;
    let consoleDiv = document.getElementById('debug-console');
    if (!consoleDiv) return; 

    const timestamp = new Date().toISOString().substr(11, 8); 
    consoleDiv.insertAdjacentHTML('beforeend', `<div style="border-bottom:1px solid #330000; padding:2px; color:#ff5555;">
        <span style="color:#888; font-size:0.6rem">[${timestamp}]</span> ${message}
    </div>`);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
};

window.initDebugSystem = function() {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv && window.debugEnabled) {
        consoleDiv.style.display = 'block'; 
        consoleDiv.innerHTML = '<div style="color:#44ff44; font-weight:bold;">--- SISTEMA LISTO ---</div>';
    }
    updateDebugButtonUI();
};

window.toggleDebugMode = function() {
    window.debugEnabled = !window.debugEnabled;
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.style.display = window.debugEnabled ? 'block' : 'none';
    updateDebugButtonUI();
    if(window.debugEnabled) logDebug("Sistema reactivado.");
};

window.clearDebugLog = function() {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.innerHTML = '<div style="color:#444">--- Log Limpiado ---</div>';
};

window.updateDebugButtonUI = function() {
    const btn = document.getElementById('btn-toggle-debug');
    if (!btn) return;
    if (window.debugEnabled) {
        btn.innerHTML = "✅ DEBUG ACTIVO";
        btn.style.background = "#064e3b"; 
        btn.style.color = "#fff";
    } else {
        btn.innerHTML = "🐞 ACTIVAR DEBUG";
        btn.style.background = "#222";
        btn.style.color = "#888";
    }
};

window.onerror = function(msg, url, line) {
    if (typeof logDebug === 'function') logDebug(`ERROR: ${msg} @ L${line}`);
};

// 2. EJECUTAR INYECCIÓN (Ahora que las funciones existen)
(function inyectarSistemaCompleto() {
    // A. Botón Candado
    const headerDiv = document.querySelector('header div');
    if (headerDiv) {
        // Evitar duplicados si el script corre dos veces
        if (!headerDiv.querySelector('.lock-btn-injected')) {
            const btnLock = document.createElement('button');
            btnLock.className = 'btn-icon lock-btn-injected';
            btnLock.innerHTML = '🔒';
            btnLock.onclick = window.abrirAdminLogin; // AHORA SÍ EXISTE
            headerDiv.insertBefore(btnLock, headerDiv.firstChild);
        }
    }

    // B. Panel de Admin
    if (!document.getElementById('panel-admin')) {
        const panelHTML = `
        <div id="panel-admin" style="display:none;">
            <div class="admin-header">
                <span>PANEL SYSTEM</span>
                <button onclick="cerrarAdminPanel()" style="background:none;border:none;color:#fff;cursor:pointer;">✕</button>
            </div>
            <div style="padding:15px;">
                <label class="lbl-title" style="margin-bottom:10px; display:block;">Diagnóstico y Control:</label>
                <button id="btn-toggle-debug" class="btn-action" style="margin-bottom: 10px;" onclick="toggleDebugMode()">
                    🐞 ACTIVAR DEBUG
                </button>
                <button class="btn-action" style="background: #220000; color: #ff5555; border: 1px solid #440000;" onclick="clearDebugLog()">
                    🗑️ LIMPIAR CONSOLA
                </button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', panelHTML);
    }

    // C. Modal Login
    if (!document.getElementById('modal-admin-login')) {
        const modalHTML = `
        <div id="modal-admin-login" class="modal-overlay" style="display:none;">
            <div class="modal-box">
                <h3>ACCESO RESTRINGIDO</h3>
                <input type="password" id="admin-pass-input" placeholder="Contraseña..." style="margin-bottom:15px;" onkeydown="if(event.key==='Enter') checkAdminPass()">
                <div style="display:flex; gap:10px; justify-content: center;">
                    <button class="btn-action" onclick="checkAdminPass()">ENTRAR</button>
                    <button class="btn-back" onclick="document.getElementById('modal-admin-login').style.display='none'">CANCELAR</button>
                </div>
                <div id="login-msg" style="color:red; margin-top:10px; font-size:0.8rem; display:none;">Acceso Denegado</div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // D. Consola
    if (!document.getElementById('debug-console')) {
        document.body.insertAdjacentHTML('beforeend', `<div id="debug-console"></div>`);
    }
    
    setTimeout(initDebugSystem, 500);
})();
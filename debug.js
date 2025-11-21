// debug.js - MÓDULO DE DIAGNÓSTICO (OPCIONAL)

// Variable global para controlar estado
window.debugEnabled = false; 

// Sobrescribimos la función vacía por defecto
window.logDebug = function(message) {
    let consoleDiv = document.getElementById('debug-console');
    if (!consoleDiv) return; // Si no hay consola en el DOM, no hacemos nada

    const timestamp = new Date().toISOString().substr(11, 8); 
    // Usamos HTML seguro
    consoleDiv.insertAdjacentHTML('beforeend', `<div style="border-bottom:1px solid #220000; padding:2px;">
        <span style="color:#555">[${timestamp}]</span> ${message}
    </div>`);
    
    // Auto-scroll
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
};

// Sobrescribimos el iniciador
window.initDebugSystem = function() {
    // Siempre empieza apagado (Volátil)
    window.debugEnabled = false;
    
    // Limpieza de memoria vieja por si acaso
    localStorage.removeItem('sys_debug_mode'); 
    
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        consoleDiv.style.display = 'none';
        consoleDiv.innerHTML = '<div style="color:#444">--- Sistema Debug Listo ---</div>';
    }
    
    updateDebugButtonUI();
    console.log("Sistema de Debug: CARGADO");
};

// Funciones exclusivas del módulo
window.toggleDebugMode = function() {
    window.debugEnabled = !window.debugEnabled;
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.style.display = window.debugEnabled ? 'block' : 'none';
    updateDebugButtonUI();
    if(window.debugEnabled) logDebug("Sistema de depuración: ACTIVADO");
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
        btn.style.borderColor = "#34d399";
        btn.style.color = "#fff";
    } else {
        btn.innerHTML = "🐞 ACTIVAR DEBUG";
        btn.style.background = "#222";
        btn.style.borderColor = "#444";
        btn.style.color = "#888";
    }
};

// Capturador de errores global
window.onerror = function(msg, url, line) {
    logDebug(`CRITICAL ERROR: ${msg} @ L${line}`);
};
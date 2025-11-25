// debug.js - MÓDULO DE DIAGNÓSTICO (AUTO-ACTIVADO)

// Variable global: EMPIEZA ENCENDIDA
window.debugEnabled = true; 

// Sobrescribimos la función vacía por defecto
window.logDebug = function(message) {
    if (!window.debugEnabled) return; // Doble chequeo

    let consoleDiv = document.getElementById('debug-console');
    if (!consoleDiv) return; 

    const timestamp = new Date().toISOString().substr(11, 8); 
    
    // Inserción segura y rápida
    consoleDiv.insertAdjacentHTML('beforeend', `<div style="border-bottom:1px solid #330000; padding:2px; color:#ff5555;">
        <span style="color:#888; font-size:0.6rem">[${timestamp}]</span> ${message}
    </div>`);
    
    // Auto-scroll al fondo
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
};

// Sobrescribimos el iniciador
window.initDebugSystem = function() {
    // FORZAMOS EL ENCENDIDO INMEDIATO
    window.debugEnabled = true;
    
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        // LO MOSTRAMOS DE GOLPE
        consoleDiv.style.display = 'block'; 
        consoleDiv.innerHTML = '<div style="color:#44ff44; font-weight:bold;">--- DEBUG SIEMPRE ACTIVO ---</div>';
    }
    
    updateDebugButtonUI();
    logDebug("Sistema de depuración: INICIADO AUTOMÁTICAMENTE");
};

// Funciones exclusivas del módulo
window.toggleDebugMode = function() {
    window.debugEnabled = !window.debugEnabled;
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) consoleDiv.style.display = window.debugEnabled ? 'block' : 'none';
    updateDebugButtonUI();
    if(window.debugEnabled) logDebug("Sistema de depuración: REACTIVADO MANUALMENTE");
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

// Capturador de errores global (Para cazar fallos de sintaxis o variables no definidas)
window.onerror = function(msg, url, line) {
    // Solo logueamos si el sistema de log ya cargó, si no, usamos console.log nativo
    if (typeof logDebug === 'function') {
        logDebug(`CRITICAL ERROR: ${msg} @ L${line}`);
    }
};
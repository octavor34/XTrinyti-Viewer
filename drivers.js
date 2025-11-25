// ==========================================
// CONFIGURACIÓN DEL SISTEMA (DRIVERS)
// ==========================================

// 1. SEGURIDAD
const SYS_PASS = "admin123"; 
const _K_ENC = 'MDc0Y2E5OTY5MWM3OWUxNzUxZDI5ZTI3NWQ4NjJmOGFlMDU3MzliMzc2NjVjNDRmN2NkY2EyNGMyMDYxNzZiZjk4YjNmNmY1Y2EyZDdjNjBlOTMxYmFhNWNmNWU3YzdiODNkYjEyMTRkNTUzMjA0MzNhOWQ5ZmYzM2FjZWU0OWQ=';
const _U_ENC = 'NTYwNDc5Ng==';

function getKeys() {
    try { return { uid: atob(_U_ENC), key: atob(_K_ENC) }; } 
    catch (e) { return { uid: '', key: '' }; }
}

// 2. RED Y PROXIES
const PROXIES = [
    { url: '', type: 'direct' },
    { url: 'https://corsproxy.io/?', type: 'light' },
    { url: 'https://api.allorigins.win/get?url=', type: 'special_unpack' },
    { url: 'https://api.codetabs.com/v1/proxy/?quest=', type: 'light' }
];

const FOURCHAN_PROXIES = [
    "https://api.codetabs.com/v1/proxy/?quest=",
    "https://api.allorigins.win/raw?url="
];

const DOWNLOAD_PROXIES = [
    'https://corsproxy.io/?', 
    'https://api.allorigins.win/raw?url=', 
    'https://api.codetabs.com/v1/proxy/?quest='
];

// 3. CATÁLOGO DE SITIOS (BOORUS)
// ¡AQUÍ ESTABA EL FALLO! Ahora incluye la configuración 'auto'
const BOORU_SITES = {
    'r34': {
        url: 'https://api.rule34.xxx',
        endpoint: '/index.php?page=dapi&s=post&q=index&json=1',
        key_needed: true,
        adapter: 'standard',
        // Configuración Autocompletado R34
        auto: {
            url: 'https://api.rule34.xxx/autocomplete.php',
            param: 'q',
            type: 'r34_legacy',
            separator: '_'
        }
    }
};
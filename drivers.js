// CONFIGURACIÓN DE SEGURIDAD
const SYS_PASS = "admin123"; 

// CREDENCIALES OFUSCADAS (Base64)
const _K_ENC = 'MDc0Y2E5OTY5MWM3OWUxNzUxZDI5ZTI3NWQ4NjJmOGFlMDU3MzliMzc2NjVjNDRmN2NkY2EyNGMyMDYxNzZiZjk4YjNmNmY1Y2EyZDdjNjBlOTMxYmFhNWNmNWU3YzdiODNkYjEyMTRkNTUzMjA0MzNhOWQ5ZmYzM2FjZWU0OWQ=';
const _U_ENC = 'NTYwNDc5Ng==';

// PROXIES DE NAVEGACIÓN
const PROXIES = [
    { url: '', type: 'direct' },
    { url: 'https://corsproxy.io/?', type: 'light' },
    { url: 'https://api.allorigins.win/get?url=', type: 'special_unpack' },
    { url: 'https://api.codetabs.com/v1/proxy/?quest=', type: 'light' }
];

// PROXIES DE 4CHAN
const FOURCHAN_PROXIES = [
    "https://api.codetabs.com/v1/proxy/?quest=",
    "https://api.allorigins.win/raw?url="
];

// PROXIES DE DESCARGA (Archivos grandes/Binarios) - MOVIDO AQUÍ
const DOWNLOAD_PROXIES = [
    'https://corsproxy.io/?', 
    'https://api.allorigins.win/raw?url=', 
    'https://api.codetabs.com/v1/proxy/?quest='
];

// Función de desofuscación
function getKeys() {
    try {
        return {
            uid: atob(_U_ENC),
            key: atob(_K_ENC)
        };
    } catch (e) {
        console.error("Error desencriptando credenciales");
        return { uid: '', key: '' };
    }
}
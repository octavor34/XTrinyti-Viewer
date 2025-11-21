// CONFIGURACIÓN DE SEGURIDAD
// Contraseña para el menú de debug (Cámbiala por la que quieras)
const SYS_PASS = "admin123"; 

// CREDENCIALES OFUSCADAS (Base64)
// Esto evita que se lean a simple vista, pero no es seguridad militar.
const _K_ENC = 'MDc0Y2E5OTY5MWM3OWUxNzUxZDI5ZTI3NWQ4NjJmOGFlMDU3MzliMzc2NjVjNDRmN2NkY2EyNGMyMDYxNzZiZjk4YjNmNmY1Y2EyZDdjNjBlOTMxYmFhNWNmNWU3YzdiODNkYjEyMTRkNTUzMjA0MzNhOWQ5ZmYzM2FjZWU0OWQ=';
const _U_ENC = 'NTYwNDc5Ng==';

// PROXIES
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

// Función de desofuscación (Solo para uso interno)
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
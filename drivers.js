// CONFIGURACIÓN Y CONSTANTES
const R34_KEY = '074ca99691c79e1751d29e275d862f8ae05739b37665c44f7cdca24c206176bf98b3f6f5ca2d7c60e931baa5cf5e7c7b83db1214d55320433a9d9ff33acee49d';
const R34_UID = '5604796';

const PROXIES = [
    // Intento directo (a veces funciona si el usuario tiene extensiones o configuración permisiva)
    { url: '', type: 'direct' },

    // El MVP actual (funciona para Reddit casi siempre)
    { url: 'https://corsproxy.io/?', type: 'light' },

    // Alternativas decentes
    { url: 'https://api.allorigins.win/get?url=', type: 'special_unpack' }, // Requiere lógica especial
    { url: 'https://api.codetabs.com/v1/proxy/?quest=', type: 'light' }
];

const FOURCHAN_PROXIES = [
    "https://api.codetabs.com/v1/proxy/?quest=",
    "https://api.allorigins.win/raw?url="
];


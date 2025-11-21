// CONFIGURACIÓN Y CONSTANTES
const R34_KEY = '074ca99691c79e1751d29e275d862f8ae05739b37665c44f7cdca24c206176bf98b3f6f5ca2d7c60e931baa5cf5e7c7b83db1214d55320433a9d9ff33acee49d';
const R34_UID = '5604796';

const PROXIES = [
    { url: '', type: 'direct' },

    // Proxy ESTABLE (funciona hoy 2025)
    { url: 'https://thingproxy.freeboard.io/fetch/', type: 'light' },

    // Proxy alternativo que acepta JSON grande
    { url: 'https://api.allorigins.win/raw?url=', type: 'light' },

    // Fallback final
    { url: 'https://cors.bypass.workers.dev/?', type: 'light' }
];
// URLs de los microservicios.
// - Por HTTPS (https://IP:5443) las APIs se piden al mismo origen a través del proxy de nginx (/api/...):
//   es lo que permite usar la cámara en el celular y evita contenido mixto.
// - Por HTTP (http://localhost:5173 o http://IP:5173) se llaman directamente los puertos 3001-3003 del mismo host.
const host = window.location.hostname || 'localhost';
window.CINE_CONFIG = window.location.protocol === 'https:'
  ? { usuarios: '/api/usuarios', peliculas: '/api/peliculas', reservas: '/api/reservas' }
  : {
      usuarios: `http://${host}:3001/api/v1`,
      peliculas: `http://${host}:3002/api/v1`,
      reservas: `http://${host}:3003/api/v1`,
    };

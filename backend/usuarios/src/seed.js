import bcrypt from 'bcryptjs';
import { Rol, Usuario, Cliente } from './model/entities/index.js';

// Cuentas de demostración. NO se publican en el frontend: solo las devuelve POST /auth/dev-access con el comando secreto.
// Deben coincidir con las cuentas creadas abajo.
export const CUENTAS_DEMO = [
  { username: 'admin', password: 'Admin123*', rol: 'ADMINISTRADOR', etiqueta: 'Administrador' },
  { username: 'operador', password: 'Operador123*', rol: 'OPERADOR', etiqueta: 'Operador' },
  { username: 'cliente1', password: 'Cliente123*', rol: 'CLIENTE', etiqueta: 'Cliente 1' },
  { username: 'cliente2', password: 'Cliente123*', rol: 'CLIENTE', etiqueta: 'Cliente 2' },
];

// Archivo semilla: se ejecuta al levantar la aplicación; solo carga datos si la tabla rol está vacía.
export async function seed() {
  if ((await Rol.count()) > 0) return;
  console.log('[usuarios] cargando datos semilla...');
  const roles = await Rol.bulkCreate([
    { nombre: 'ADMINISTRADOR', descripcion: 'Control total del sistema', estado: 'ACTIVO' },
    { nombre: 'OPERADOR', descripcion: 'Gestión operativa de cartelera, funciones y reservas', estado: 'ACTIVO' },
    { nombre: 'CLIENTE', descripcion: 'Consulta cartelera y gestiona sus reservas', estado: 'ACTIVO' },
  ]);
  const id = Object.fromEntries(roles.map((r) => [r.nombre, r.id]));
  const cuentas = [
    ['admin', 'Admin123*', 'ADMINISTRADOR', { primer_nombre: 'Carla', apellido: 'Mendoza', dni: '1700000001', correo: 'admin@cine.local', nacionalidad: 'Ecuatoriana' }],
    ['operador', 'Operador123*', 'OPERADOR', { primer_nombre: 'Diego', apellido: 'Salazar', dni: '1700000002', correo: 'operador@cine.local', nacionalidad: 'Ecuatoriana' }],
    ['cliente1', 'Cliente123*', 'CLIENTE', { primer_nombre: 'Ana', segundo_nombre: 'María', apellido: 'Torres', dni: '1712345678', correo: 'ana.torres@correo.test', nacionalidad: 'Ecuatoriana', direccion: 'Av. Amazonas N24, Quito', telefono: '0991234567' }],
    ['cliente2', 'Cliente123*', 'CLIENTE', { primer_nombre: 'Luis', segundo_nombre: 'Carlos', apellido: 'Pérez', dni: '1723456789', correo: 'luis.perez@correo.test', nacionalidad: 'Ecuatoriana', direccion: 'Calle Bolívar 15, Quito', telefono: '0987654321' }],
  ];
  for (const [username, pass, rol, datos] of cuentas) {
    const u = await Usuario.create({ username, password_hash: await bcrypt.hash(pass, 10), rol_id: id[rol] });
    await Cliente.create({ ...datos, usuario_id: u.id });
  }
  console.log('[usuarios] semilla lista: admin / operador / cliente1 / cliente2');
}

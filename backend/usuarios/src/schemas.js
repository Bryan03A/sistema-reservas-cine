import { z } from 'zod';

const texto = (max) => z.string().trim().min(1, 'Campo obligatorio').max(max).regex(/^[^<>]*$/, 'No se permiten los caracteres < >');

export const datosPersonales = z.object({
  primer_nombre: texto(50),
  segundo_nombre: z.string().trim().max(50).regex(/^[^<>]*$/).optional().or(z.literal('')),
  apellido: texto(50),
  dni: z.string().trim().regex(/^\d{10}(\d{3})?$/, 'El DNI debe tener 10 dígitos (cédula) o 13 (RUC)'),
  nacionalidad: z.string().trim().max(50).regex(/^[^<>]*$/).optional().or(z.literal('')),
  direccion: z.string().trim().max(200).regex(/^[^<>]*$/).optional().or(z.literal('')),
  telefono: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Teléfono inválido').optional().or(z.literal('')),
  correo: z.string().trim().toLowerCase().email('Correo inválido').max(120),
});

export const crearUsuarioSchema = datosPersonales.extend({
  rol: z.enum(['ADMINISTRADOR', 'OPERADOR', 'CLIENTE']).default('CLIENTE'),
});

const passwordNueva = z.string().min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[a-z]/, 'Debe incluir una minúscula').regex(/\d/, 'Debe incluir un número');
const confirmaPassword = (d) => !d.password_nueva || d.password_nueva === d.password_confirmacion;

// Solo el administrador usa este esquema: puede editar cualquier dato personal (incluido DNI), el rol y fijar una contraseña nueva
export const actualizarUsuarioSchema = datosPersonales.partial().extend({
  rol: z.enum(['ADMINISTRADOR', 'OPERADOR', 'CLIENTE']).optional(),
  password_nueva: passwordNueva.optional(),
  password_confirmacion: z.string().optional(),
}).refine(confirmaPassword, { message: 'La confirmación no coincide con la nueva contraseña', path: ['password_confirmacion'] });

export const estadoSchema = z.object({ estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO']) });

// El propio usuario puede editar solo estos campos (el DNI y el usuario NO se pueden cambiar)
const opc = (max) => z.string().trim().max(max).regex(/^[^<>]*$/, 'No se permiten los caracteres < >');
export const perfilSchema = z.object({
  primer_nombre: texto(50).optional(),
  segundo_nombre: opc(50).optional(),
  apellido: texto(50).optional(),
  nacionalidad: opc(50).optional(),
  direccion: opc(200).optional(),
  telefono: z.string().trim().regex(/^([0-9+\-\s]{7,15})?$/, 'Teléfono inválido').optional(),
  correo: z.string().trim().toLowerCase().email('Correo inválido').max(120).optional(),
}).strict();

export const cambioPasswordSchema = z.object({
  password_actual: z.string().min(1, 'Ingresa tu contraseña actual'),
  password_nueva: passwordNueva,
  password_confirmacion: z.string().min(1, 'Confirma la nueva contraseña'),
}).refine((d) => d.password_nueva === d.password_confirmacion, { message: 'La confirmación no coincide con la nueva contraseña', path: ['password_confirmacion'] })
  .refine((d) => d.password_nueva !== d.password_actual, { message: 'La nueva contraseña debe ser distinta de la actual', path: ['password_nueva'] });

// Nombre de usuario elegido por el cliente: debe empezar con letra o número, así que un comando como "/dev" jamás es válido
export const usernameSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{3,29}$/, 'Usa de 4 a 30 caracteres: letras minúsculas, números, punto, guion o guion bajo, empezando por letra o número'),
});
export const RESERVADOS = ['admin', 'administrador', 'operador', 'root', 'sistema', 'soporte', 'cine', 'api', 'usuario', 'null', 'undefined'];

export const auditoriaSchema = z.object({
  usuario_id: z.number().int(),
  accion: z.string().trim().min(1).max(30),
  entidad: z.string().trim().min(1).max(50),
  entidad_id: z.number().int().nullable().optional(),
  descripcion: z.string().max(1000).optional(),
});

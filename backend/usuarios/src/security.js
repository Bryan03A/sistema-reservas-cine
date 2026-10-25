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

export const actualizarUsuarioSchema = datosPersonales.partial().extend({
  rol: z.enum(['ADMINISTRADOR', 'OPERADOR', 'CLIENTE']).optional(),
});

export const estadoSchema = z.object({ estado: z.enum(['ACTIVO', 'INACTIVO', 'BLOQUEADO']) });

export const perfilSchema = z.object({
  nacionalidad: z.string().trim().max(50).regex(/^[^<>]*$/).optional(),
  direccion: z.string().trim().max(200).regex(/^[^<>]*$/).optional(),
  telefono: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Teléfono inválido').optional(),
});

export const cambioPasswordSchema = z.object({
  password_actual: z.string().min(1),
  password_nueva: z.string().min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula').regex(/[a-z]/, 'Debe incluir una minúscula').regex(/\d/, 'Debe incluir un número'),
});

export const auditoriaSchema = z.object({
  usuario_id: z.number().int(),
  accion: z.string().trim().min(1).max(30),
  entidad: z.string().trim().min(1).max(50),
  entidad_id: z.number().int().nullable().optional(),
  descripcion: z.string().max(1000).optional(),
});

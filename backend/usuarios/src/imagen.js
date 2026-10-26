import express from 'express';
import { AppError } from './errors.js';
import { config } from './config.js';

// Recibe la imagen como cuerpo binario (Content-Type image/jpeg | image/png | image/webp)
export const rawImagen = () => express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: config.maxFotoBytes });

// Se valida el contenido real (firma del archivo), no solo el Content-Type que declara el cliente
export function detectarTipo(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function leerImagen(req) {
  const b = req.body;
  if (!Buffer.isBuffer(b) || !b.length) throw new AppError(415, 'IMAGEN_REQUERIDA', 'Envía la imagen como cuerpo de la petición (Content-Type: image/jpeg, image/png o image/webp)');
  const tipo = detectarTipo(b);
  if (!tipo) throw new AppError(422, 'IMAGEN_INVALIDA', 'El archivo no es una imagen JPG, PNG o WEBP válida');
  return { buffer: b, tipo };
}

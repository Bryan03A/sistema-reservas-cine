import { Request, Response } from "express";
import {
  obtenerJwks,
  obtenerToken,
  registrarUsuario
} from "./auth.service";

export async function register(req: Request, res: Response) {
  try {
    const resultado = await registrarUsuario(req.body);
    return res.status(201).json({
      mensaje: "Usuario registrado correctamente.",
      usuario: resultado
    });
  } catch (error: any) {
    const status = Number(error?.status) || 500;

    if (status === 500) {
      console.error("Error en registro:", error.message);
    }

    return res.status(status).json({
      error: status === 500
        ? "Error interno del servidor."
        : error.message
    });
  }
}

export async function token(req: Request, res: Response) {
  try {
    const resultado = await obtenerToken(req.body);
    return res.status(200).json(resultado);
  } catch (error: any) {
    const status = Number(error?.status) || 500;

    if (status === 500) {
      console.error("Error en token:", error.message);
    }

    return res.status(status).json({
      error: status === 500
        ? "Error interno del servidor."
        : error.message
    });
  }
}

export function jwks(_req: Request, res: Response) {
  return res.status(200).json(obtenerJwks());
}
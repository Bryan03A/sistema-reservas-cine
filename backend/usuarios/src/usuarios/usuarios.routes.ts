import { Router, Response } from "express";

import {
  autenticar,
  RequestAutenticado
} from "../middleware/autenticar";
import { autorizar } from "../middleware/autorizar";

import {
  listarUsuarios,
  consultarUsuario,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  ErrorServicio
} from "./usuarios.service";

const router = Router();

function manejarError(error: unknown, res: Response) {
  if (error instanceof ErrorServicio) {
    return res.status(error.status).json({
      error: error.message
    });
  }

  console.error("Error en el módulo de usuarios:", error);

  return res.status(500).json({
    error: "Ocurrió un error interno al procesar la solicitud."
  });
}

router.get("/usuarios", autenticar, autorizar("ADMINISTRADOR"), async (_req, res) => {
  try {
    return res.status(200).json(await listarUsuarios());
  } catch (error) {
    return manejarError(error, res);
  }
});

router.get("/usuarios/:id", autenticar, autorizar("ADMINISTRADOR"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    return res.status(200).json(await consultarUsuario(id));
  } catch (error) {
    return manejarError(error, res);
  }
});

router.post(
  "/usuarios", autenticar, autorizar("ADMINISTRADOR"),
  async (req: RequestAutenticado, res) => {
    try {
      const usuario = await crearUsuario(
        req.auth!.sub,
        req.body
      );

      return res.status(201).json({
        mensaje: "Usuario creado correctamente.",
        usuario
      });
    } catch (error) {
      return manejarError(error, res);
    }
  }
);

router.put(
  "/usuarios/:id", autenticar, autorizar("ADMINISTRADOR"),
  async (req: RequestAutenticado, res) => {
    try {
      const id = Number(req.params.id);

      const usuario = await actualizarUsuario(
        req.auth!.sub,
        id,
        req.body
      );

      return res.status(200).json({
        mensaje: "Usuario actualizado correctamente.",
        usuario
      });
    } catch (error) {
      return manejarError(error, res);
    }
  }
);

router.delete(
  "/usuarios/:id", autenticar, autorizar("ADMINISTRADOR"),
  async (req: RequestAutenticado, res) => {
    try {
      const id = Number(req.params.id);

      const resultado = await desactivarUsuario(
        req.auth!.sub,
        id
      );

      return res.status(200).json(resultado);
    } catch (error) {
      return manejarError(error, res);
    }
  }
);

export default router;

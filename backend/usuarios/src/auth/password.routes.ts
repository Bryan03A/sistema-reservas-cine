
import { Router, Response, NextFunction } from "express";
import {
  autenticar,
  RequestAutenticado
} from "../middleware/autenticar";
import { cambiarPassword } from "./password.service";

const router = Router();

router.post(
  "/auth/change-password",
  autenticar,
  async (
    req: RequestAutenticado,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { passwordActual, passwordNueva } = req.body ?? {};

      const usuarioId = Number(req.auth?.sub);

      if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
        res.status(401).json({
          error: "Token de autenticación inválido."
        });
        return;
      }

      await cambiarPassword(
        usuarioId,
        passwordActual,
        passwordNueva
      );

      res.status(200).json({
        mensaje: "Contraseña actualizada correctamente."
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

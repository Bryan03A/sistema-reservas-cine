import { Response, NextFunction } from "express";
import { RequestAutenticado } from "./autenticar";

export function autorizar(...rolesPermitidos: string[]) {
  return (
    req: RequestAutenticado,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.auth) {
      return res.status(401).json({
        error: "Primero debes autenticarte."
      });
    }

    const tienePermiso = req.auth.roles.some(rol =>
      rolesPermitidos.includes(rol)
    );

    if (!tienePermiso) {
      return res.status(403).json({
        error: "No tienes permisos para acceder a este recurso."
      });
    }

    return next();
  };
}
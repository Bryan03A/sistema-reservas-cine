
import { Router } from "express";

import {
  autenticar,
  type RequestAutenticado
} from "../middleware/autenticar";
import { autorizar } from "../middleware/autorizar";
import { AppDataSource } from "../config/database";
import { registrarAuditoria } from "./auditoria.service";
import { RegistroAuditoria } from "../model/entities/RegistroAuditoria";

const router = Router();

// Consultar auditorías: solo administradores.
router.get(
  "/auditoria",
  autenticar,
  autorizar("ADMINISTRADOR"),
  async (req, res) => {
    try {
      const pagina = Number(req.query.pagina ?? 1);
      const limite = Number(req.query.limite ?? 20);

      if (
        !Number.isInteger(pagina) ||
        pagina < 1 ||
        !Number.isInteger(limite) ||
        limite < 1 ||
        limite > 100
      ) {
        return res.status(400).json({
          error:
            "La página debe ser positiva y el límite debe estar entre 1 y 100."
        });
      }

      const [registros, total] = await AppDataSource
        .getRepository(RegistroAuditoria)
        .findAndCount({
          order: {
            fechaAccion: "DESC",
            id: "DESC"
          },
          skip: (pagina - 1) * limite,
          take: limite
        });

      return res.status(200).json({
        total,
        pagina,
        limite,
        registros
      });
    } catch (error) {
      console.error("Error consultando auditoría:", error);

      return res.status(500).json({
        error: "No se pudieron consultar los registros de auditoría."
      });
    }
  }
);

// Registrar una acción administrativa procedente de otro microservicio.
router.post(
  "/auditoria",
  autenticar,
  autorizar("ADMINISTRADOR"),
  async (req, res) => {
    try {
      const auth = (req as RequestAutenticado).auth;
      const usuarioId = Number(auth?.sub);

      if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return res.status(401).json({
          error: "El identificador del usuario autenticado no es válido."
        });
      }

      const {
        accion,
        entidad,
        entidadId,
        descripcion
      } = req.body ?? {};

      const accionesPermitidas = [
        "CREAR",
        "ACTUALIZAR",
        "CAMBIAR_ESTADO",
        "CANCELAR"
      ];

      const entidadesPermitidas = [
        "pelicula",
        "funcion",
        "asiento"
      ];

      if (
        typeof accion !== "string" ||
        !accionesPermitidas.includes(accion) ||
        typeof entidad !== "string" ||
        !entidadesPermitidas.includes(entidad)
      ) {
        return res.status(400).json({
          error: "La acción o la entidad de auditoría no son válidas."
        });
      }

      if (
        entidadId !== undefined &&
        entidadId !== null &&
        (
          !Number.isSafeInteger(entidadId) ||
          entidadId <= 0
        )
      ) {
        return res.status(400).json({
          error:
            "El identificador de la entidad debe ser un entero positivo o null."
        });
      }

      if (
        descripcion !== undefined &&
        descripcion !== null &&
        (
          typeof descripcion !== "string" ||
          descripcion.length > 2000
        )
      ) {
        return res.status(400).json({
          error:
            "La descripción debe ser texto de hasta 2000 caracteres."
        });
      }

      const registro = await registrarAuditoria(
        AppDataSource.manager,
        {
          usuarioId,
          accion,
          entidad,
          entidadId: entidadId ?? null,
          descripcion: descripcion ?? null
        }
      );

      return res.status(201).json({
        mensaje: "Auditoría registrada correctamente.",
        registro
      });
    } catch (error) {
      console.error("Error registrando auditoría:", error);

      return res.status(500).json({
        error: "No se pudo registrar la auditoría."
      });
    }
  }
);

export default router;

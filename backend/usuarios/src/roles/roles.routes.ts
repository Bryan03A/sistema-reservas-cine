
import { Router } from "express";
import { AppDataSource } from "../config/database";
import { Rol } from "../model/entities/Rol";
import { autenticar } from "../middleware/autenticar";

const router = Router();

router.get(
  "/roles",
  autenticar,
  async (_req, res, next) => {
    try {
      const roles = await AppDataSource
        .getRepository(Rol)
        .find({
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            estado: true
          },
          order: {
            id: "ASC"
          }
        });

      res.status(200).json(roles);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

import "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./auth/auth.routes";
import { autenticar } from "./middleware/autenticar";
import { autorizar } from "./middleware/autorizar";

import passwordRoutes from "./auth/password.routes";
import rolesRoutes from "./roles/roles.routes";
import clientesRoutes from "./clientes/clientes.routes";

import usuariosRoutes from "./usuarios/usuarios.routes";
import auditoriaRoutes from "./auditoria/auditoria.routes";

import swaggerUi from "swagger-ui-express";
import { swaggerDocument } from "./docs/swagger";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.use(authRoutes);

app.use(passwordRoutes);
app.use(rolesRoutes);
app.use(clientesRoutes);
app.use(usuariosRoutes);
app.use(auditoriaRoutes);


app.get("/health", (_req, res) => {
  res.status(200).json({
    estado: "ok",
    servicio: "cine-auth"
  });
});

// Endpoint para administradores.
app.get(
  "/pruebas/admin",
  autenticar,
  autorizar("ADMINISTRADOR"),
  (_req, res) => {
    res.status(200).json({
      mensaje: "Acceso autorizado para administrador."
    });
  }
);

// Endpoint para administradores y operadores.
app.get(
  "/pruebas/operador",
  autenticar,
  autorizar("ADMINISTRADOR", "OPERADOR"),
  (_req, res) => {
    res.status(200).json({
      mensaje: "Acceso autorizado para administrador u operador."
    });
  }
);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

app.use((_req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada."
  });
});

export default app;

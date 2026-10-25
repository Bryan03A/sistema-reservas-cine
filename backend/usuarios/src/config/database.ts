import "reflect-metadata";
import "./env";
import { DataSource } from "typeorm";

import { Rol } from "../model/entities/Rol";
import { Usuario } from "../model/entities/Usuario";
import { Cliente } from "../model/entities/Cliente";
import { RegistroAuditoria } from "../model/entities/RegistroAuditoria";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USER ?? "cine_app",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? "cine_usuarios",

  entities: [Rol, Usuario, Cliente, RegistroAuditoria],

  // Solo para desarrollo. En producción se utilizarán migraciones.
  synchronize: process.env.TYPEORM_SYNCHRONIZE === "true",

  logging: process.env.NODE_ENV === "development"
});
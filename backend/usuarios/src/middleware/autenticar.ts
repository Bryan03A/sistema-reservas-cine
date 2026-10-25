import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const publicKey = readFileSync(
  join(process.cwd(), "keys", "public.pem"),
  "utf8"
);

export interface DatosToken {
  sub: string;
  username: string;
  roles: string[];
  role?: string;
}

export interface RequestAutenticado extends Request {
  auth?: DatosToken;
}

export function autenticar(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Se requiere un token Bearer válido."
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: process.env.JWT_ISSUER ?? "cine-auth",
      audience: process.env.JWT_AUDIENCE ?? "cine-api"
    });

    if (
      typeof decoded === "string" ||
      !decoded.sub ||
      typeof decoded.username !== "string"
    ) {
      return res.status(401).json({ error: "Token inválido." });
    }

    const roles = Array.isArray(decoded.roles)
      ? decoded.roles.filter((role): role is string => typeof role === "string")
      : [];

    if (roles.length === 0) {
      return res.status(401).json({ error: "El token no contiene roles válidos." });
    }

    req.auth = {
      sub: decoded.sub,
      username: decoded.username,
      roles,
      role: typeof decoded.role === "string" ? decoded.role : undefined
    };

    return next();
  } catch {
    return res.status(401).json({
      error: "Token inválido, vencido o no confiable."
    });
  }
}

import "../config/env";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createPublicKey, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AppDataSource } from "../config/database";
import { Rol } from "../model/entities/Rol";
import { Usuario } from "../model/entities/Usuario";
import { Cliente } from "../model/entities/Cliente";
import { RegistroAuditoria } from "../model/entities/RegistroAuditoria";
import { enviarCredenciales } from "../email/email.service";

// Configuración de claves RSA.
const privateKeyPath = join(process.cwd(), "keys", "private.pem");
const publicKeyPath = join(process.cwd(), "keys", "public.pem");

const privateKey = readFileSync(privateKeyPath, "utf8");
const publicKey = readFileSync(publicKeyPath, "utf8");

const KEY_ID = "cine-auth-rs256-2026";
const ISSUER = process.env.JWT_ISSUER ?? "cine-auth";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "cine-api";

// Normalizar entradas.
function normalizarTexto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Validar nombres y apellidos.
function validarNombre(nombre: string): boolean {
  return /^[\p{L}][\p{L}\s'-]{1,49}$/u.test(nombre);
}

// Validar correo electrónico.
function validarCorreo(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Generar username a partir del nombre y apellido.
function crearUsername(
  primerNombre: string,
  apellido: string
): string {
  const base = `${primerNombre}.${apellido}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);

  return base || "usuario";
}

// Comprobar disponibilidad del username.
async function usernameDisponible(base: string): Promise<string> {
  const repo = AppDataSource.getRepository(Usuario);

  let candidato = base;
  let numero = 1;

  while (await repo.findOneBy({ username: candidato })) {
    candidato = `${base.slice(0, 44)}${numero}`;
    numero++;
  }

  return candidato;
}

// Registrar un nuevo cliente mediante la API.
export async function registrarUsuario(datos: {
  primerNombre?: unknown;
  segundoNombre?: unknown;
  apellido?: unknown;
  dni?: unknown;
  nacionalidad?: unknown;
  direccion?: unknown;
  telefono?: unknown;
  correo?: unknown;
}) {
  // 1. Leer y normalizar los campos del JSON.
  const primerNombre = normalizarTexto(datos.primerNombre);
  const segundoNombre = normalizarTexto(datos.segundoNombre);
  const apellido = normalizarTexto(datos.apellido);
  const dni = normalizarTexto(datos.dni);
  const nacionalidad = normalizarTexto(datos.nacionalidad);
  const direccion = normalizarTexto(datos.direccion);
  const telefono = normalizarTexto(datos.telefono);
  const correo = normalizarTexto(datos.correo).toLowerCase();

  // 2. Validar los datos recibidos.
  const telefonoValido =
    telefono === "" ||
    /^[0-9+\-()\s]{7,15}$/.test(telefono);

  
if (
  !validarNombre(primerNombre) ||
  (
    segundoNombre !== "" &&
    !validarNombre(segundoNombre)
  ) ||
  !validarNombre(apellido) ||
  !validarCorreo(correo) ||
  correo.length > 120 ||
  !/^\d{10,13}$/.test(dni) ||
  nacionalidad.length > 50 ||
  direccion.length > 200 ||
  !telefonoValido
) {
  throw Object.assign(
    new Error(
      "Datos inválidos. Revisa nombres, apellidos, correo, DNI y teléfono."
    ),
    { status: 400 }
  );
}

  // 3. Verificar que correo y DNI no estén registrados.
  const clienteRepo = AppDataSource.getRepository(Cliente);
  const rolRepo = AppDataSource.getRepository(Rol);

  const correoExistente = await clienteRepo.findOneBy({
    correo
  });

  if (correoExistente) {
    throw Object.assign(
      new Error("El correo ya está registrado."),
      { status: 409 }
    );
  }

  const dniExistente = await clienteRepo.findOneBy({
    dni
  });

  if (dniExistente) {
    throw Object.assign(
      new Error("El DNI ya está registrado."),
      { status: 409 }
    );
  }

  // 4. Buscar un username disponible.
  const username = await usernameDisponible(
    crearUsername(primerNombre, apellido)
  );

  // 5. Generar una contraseña inicial aleatoria y su hash.
  const passwordInicial =
    `Ci${randomBytes(12).toString("base64url")}!`;

  const passwordHash = await bcrypt.hash(passwordInicial, 12);

  // 6. Comprobar que existe el rol CLIENTE y que está activo.
  const rolCliente = await rolRepo.findOneBy({
    nombre: "CLIENTE"
  });

  if (!rolCliente || rolCliente.estado !== "ACTIVO") {
    throw Object.assign(
      new Error(
        "No existe un rol CLIENTE activo. Revisa la semilla."
      ),
      { status: 500 }
    );
  }

  // 7. Crear usuario, perfil y auditoría en una transacción.
  const resultado = await AppDataSource.transaction(
    async manager => {
      const usuarioRepoTx = manager.getRepository(Usuario);
      const clienteRepoTx = manager.getRepository(Cliente);
      const auditoriaRepoTx =
        manager.getRepository(RegistroAuditoria);

      const usuario = await usuarioRepoTx.save(
        usuarioRepoTx.create({
          username,
          passwordHash,
          rolId: rolCliente.id,
          estado: "ACTIVO",
          ultimaConexion: null
        })
      );

      await clienteRepoTx.save(
        clienteRepoTx.create({
          usuarioId: usuario.id,
          primerNombre,
          segundoNombre: segundoNombre || null,
          apellido,
          dni,
          nacionalidad: nacionalidad || null,
          direccion: direccion || null,
          telefono: telefono || null,
          correo
        })
      );

      await auditoriaRepoTx.save(
        auditoriaRepoTx.create({
          usuarioId: usuario.id,
          accion: "CREAR",
          entidad: "usuario",
          entidadId: usuario.id,
          descripcion: "Cuenta de cliente creada mediante API"
        })
      );

      return usuario;
    }
  );

  // 8. Registrar el envío pendiente de credenciales.
  // La integración real del correo queda fuera de este servicio.
  try {
    await enviarCredenciales(
      correo,
      username,
      passwordInicial
    );
  } catch (error) {
    console.error(
      "La cuenta fue creada, pero no se pudo enviar el correo:",
      error
    );
  }

  // 9. Devolver los datos necesarios para la respuesta HTTP.
  return {
    id: resultado.id,
    username,
    correo,
    passwordInicial
  };
}

// Obtener un token OAuth/JWT.
export async function obtenerToken(datos: {
  grant_type?: unknown;
  username?: unknown;
  password?: unknown;
}) {
  if (datos.grant_type !== "password") {
    throw Object.assign(
      new Error("grant_type debe ser password."),
      { status: 400 }
    );
  }

  const username = normalizarTexto(datos.username);

  const password =
    typeof datos.password === "string"
      ? datos.password
      : "";

  if (!username || !password) {
    throw Object.assign(
      new Error("Debes indicar username y password."),
      { status: 400 }
    );
  }

  const usuarioRepo = AppDataSource.getRepository(Usuario);
  const rolRepo = AppDataSource.getRepository(Rol);

  // Buscar usuario.
  const usuario = await usuarioRepo.findOneBy({
    username
  });

  // Validar credenciales.
  if (
    !usuario ||
    !(await bcrypt.compare(password, usuario.passwordHash))
  ) {
    throw Object.assign(
      new Error("Credenciales incorrectas."),
      { status: 401 }
    );
  }

  // Rechazar cuentas inactivas.
  if (usuario.estado !== "ACTIVO") {
    throw Object.assign(
      new Error("La cuenta está inactiva."),
      { status: 403 }
    );
  }

  // Validar rol.
  const rol = await rolRepo.findOneBy({
    id: usuario.rolId
  });

  if (!rol || rol.estado !== "ACTIVO") {
    throw Object.assign(
      new Error("La cuenta no tiene un rol activo válido."),
      { status: 403 }
    );
  }

  // Actualizar última conexión.
  usuario.ultimaConexion = new Date();

  await usuarioRepo.save(usuario);

  // Crear JWT firmado con RS256.
  const token = jwt.sign(
    {
      username: usuario.username,
      roles: [rol.nombre],
      role: rol.nombre
    },
    privateKey,
    {
      algorithm: "RS256",
      expiresIn:
        (process.env.JWT_EXPIRES_IN ?? "15m") as
          jwt.SignOptions["expiresIn"],
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: String(usuario.id),
      keyid: KEY_ID
    }
  );

  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: 900
  };
}

// Publicar la clave pública RSA en formato JWKS.
export function obtenerJwks() {
  const jwk = createPublicKey(publicKey).export({
    format: "jwk"
  });

  return {
    keys: [
      {
        kty: "RSA",
        use: "sig",
        alg: "RS256",
        kid: KEY_ID,
        n: jwk.n,
        e: jwk.e
      }
    ]
  };
}

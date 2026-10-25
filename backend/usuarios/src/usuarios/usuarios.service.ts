
import bcrypt from "bcryptjs";
import { EntityManager } from "typeorm";

import { AppDataSource } from "../config/database";
import { Usuario } from "../model/entities/Usuario";
import { Rol } from "../model/entities/Rol";
import { Cliente } from "../model/entities/Cliente";
import { registrarAuditoria } from "../auditoria/auditoria.service";

export class ErrorServicio extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ErrorServicio";
  }
}

function validarId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErrorServicio(400, "El identificador no es válido.");
  }
}

function validarTexto(
  valor: unknown,
  campo: string,
  maximo: number
): string {
  if (
    typeof valor !== "string" ||
    valor.trim().length === 0 ||
    valor.trim().length > maximo
  ) {
    throw new ErrorServicio(
      400,
      `${campo} es obligatorio y admite hasta ${maximo} caracteres.`
    );
  }

  return valor.trim();
}

function validarEstado(valor: unknown): string {
  if (valor !== "ACTIVO" && valor !== "INACTIVO") {
    throw new ErrorServicio(
      400,
      "El estado debe ser ACTIVO o INACTIVO."
    );
  }

  return valor;
}

function validarPassword(valor: unknown): string {
  if (
    typeof valor !== "string" ||
    valor.length < 8 ||
    valor.length > 72
  ) {
    throw new ErrorServicio(
      400,
      "La contraseña debe tener entre 8 y 72 caracteres."
    );
  }

  return valor;
}

function convertirUsuarioId(sub: string): number {
  if (!/^[1-9]\d*$/.test(sub)) {
    throw new ErrorServicio(
      401,
      "El identificador del token no es válido."
    );
  }

  const id = Number(sub);
  validarId(id);
  return id;
}

function validarCampos(
  body: Record<string, unknown>,
  permitidos: string[]
): void {
  const desconocidos = Object.keys(body).filter(
    campo => !permitidos.includes(campo)
  );

  if (desconocidos.length > 0) {
    throw new ErrorServicio(
      400,
      `Campos no permitidos: ${desconocidos.join(", ")}.`
    );
  }
}

function respuestaUsuario(
  usuario: Usuario,
  rol?: Rol
) {
  return {
    id: usuario.id,
    username: usuario.username,
    rolId: usuario.rolId,
    rol: rol?.nombre ?? null,
    estado: usuario.estado,
    ultimaConexion: usuario.ultimaConexion,
    createdAt: usuario.createdAt
  };
}

async function obtenerRolActivo(
  manager: EntityManager,
  rolId: number
): Promise<Rol> {
  validarId(rolId);

  const rol = await manager.getRepository(Rol).findOneBy({
    id: rolId
  });

  if (!rol || rol.estado !== "ACTIVO") {
    throw new ErrorServicio(
      400,
      "El rol no existe o está inactivo."
    );
  }

  return rol;
}

export async function listarUsuarios() {
  const usuarios = await AppDataSource
    .getRepository(Usuario)
    .createQueryBuilder("usuario")
    .leftJoin(
      Rol,
      "rol",
      "rol.id = usuario.rolId"
    )
    .select([
      "usuario.id",
      "usuario.username",
      "usuario.rolId",
      "usuario.estado",
      "usuario.ultimaConexion",
      "usuario.createdAt"
    ])
    .addSelect("rol.nombre", "rolNombre")
    .orderBy("usuario.id", "ASC")
    .getRawMany();

  return {
    total: usuarios.length,
    usuarios: usuarios.map(usuario => ({
      id: usuario.usuario_id,
      username: usuario.usuario_username,
      rolId: usuario.usuario_rol_id,
      rol: usuario.rolNombre ?? null,
      estado: usuario.usuario_estado,
      ultimaConexion: usuario.usuario_ultima_conexion,
      createdAt: usuario.usuario_created_at
    }))
  };
}

export async function consultarUsuario(id: number) {
  validarId(id);

  const usuario = await AppDataSource
    .getRepository(Usuario)
    .findOneBy({ id });

  if (!usuario) {
    throw new ErrorServicio(404, "Usuario no encontrado.");
  }

  const rol = await AppDataSource
    .getRepository(Rol)
    .findOneBy({ id: usuario.rolId });

  return respuestaUsuario(usuario, rol ?? undefined);
}

export async function crearUsuario(
  administradorSub: string,
  body: Record<string, unknown>
) {
  const administradorId = convertirUsuarioId(administradorSub);

  validarCampos(body, [
    "username",
    "password",
    "rolId",
    "estado"
  ]);

  const username = validarTexto(body.username, "username", 50);

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    throw new ErrorServicio(
      400,
      "username solo puede contener letras, números, puntos, guiones y guiones bajos."
    );
  }

  const password = validarPassword(body.password);

  if (
    typeof body.rolId !== "number" ||
    !Number.isSafeInteger(body.rolId)
  ) {
    throw new ErrorServicio(400, "rolId debe ser un número entero.");
  }

  const estado = body.estado === undefined
    ? "ACTIVO"
    : validarEstado(body.estado);

  try {
    return await AppDataSource.transaction(async manager => {
      const repositorio = manager.getRepository(Usuario);

      const existente = await repositorio.findOneBy({ username });

      if (existente) {
        throw new ErrorServicio(409, "El username ya está registrado.");
      }

      const rol = await obtenerRolActivo(manager, body.rolId as number);
      const passwordHash = await bcrypt.hash(password, 12);

      const usuario = repositorio.create({
        username,
        passwordHash,
        rolId: rol.id,
        estado,
        ultimaConexion: null
      });

      const guardado = await repositorio.save(usuario);

      await registrarAuditoria(manager, {
        usuarioId: administradorId,
        accion: "CREAR",
        entidad: "usuario",
        entidadId: guardado.id,
        descripcion: `Se creó el usuario ${guardado.username} con rol ${rol.nombre}.`
      });

      return respuestaUsuario(guardado, rol);
    });
  } catch (error) {
    if (error instanceof ErrorServicio) throw error;

    if ((error as { code?: string })?.code === "23505") {
      throw new ErrorServicio(409, "El username ya está registrado.");
    }

    throw error;
  }
}

export async function actualizarUsuario(
  administradorSub: string,
  id: number,
  body: Record<string, unknown>
) {
  validarId(id);

  const administradorId = convertirUsuarioId(administradorSub);

  validarCampos(body, [
    "username",
    "password",
    "rolId",
    "estado"
  ]);

  if (Object.keys(body).length === 0) {
    throw new ErrorServicio(400, "Debes enviar al menos un campo.");
  }

  try {
    return await AppDataSource.transaction(async manager => {
      const repositorio = manager.getRepository(Usuario);
      const usuario = await repositorio.findOneBy({ id });

      if (!usuario) {
        throw new ErrorServicio(404, "Usuario no encontrado.");
      }

      if (body.username !== undefined) {
        usuario.username = validarTexto(
          body.username,
          "username",
          50
        );

        if (!/^[a-zA-Z0-9_.-]+$/.test(usuario.username)) {
          throw new ErrorServicio(400, "Formato de username no válido.");
        }

        const duplicado = await repositorio
          .createQueryBuilder("usuario")
          .where("usuario.username = :username", {
            username: usuario.username
          })
          .andWhere("usuario.id != :id", { id })
          .getOne();

        if (duplicado) {
          throw new ErrorServicio(409, "El username ya está registrado.");
        }
      }

      if (body.password !== undefined) {
        const password = validarPassword(body.password);
        usuario.passwordHash = await bcrypt.hash(password, 12);
      }

      if (body.rolId !== undefined) {
        if (
          typeof body.rolId !== "number" ||
          !Number.isSafeInteger(body.rolId)
        ) {
          throw new ErrorServicio(400, "rolId debe ser un número entero.");
        }

        const rolNuevo = await obtenerRolActivo(
          manager,
          body.rolId
        );

        usuario.rolId = rolNuevo.id;
      }

      if (body.estado !== undefined) {
        usuario.estado = validarEstado(body.estado);
      }

      // Evita que el administrador se desactive a sí mismo
      // o se quite el rol de administrador durante su sesión.
      if (usuario.id === administradorId) {
        if (
          usuario.estado !== "ACTIVO" ||
          (body.rolId !== undefined &&
            usuario.rolId !== (await manager.getRepository(Usuario)
              .findOneByOrFail({ id: administradorId })).rolId)
        ) {
          throw new ErrorServicio(
            400,
            "No puedes desactivar tu cuenta ni cambiar tu propio rol desde esta operación."
          );
        }
      }

      const guardado = await repositorio.save(usuario);

      const rol = await manager.getRepository(Rol).findOneBy({
        id: guardado.rolId
      });

      await registrarAuditoria(manager, {
        usuarioId: administradorId,
        accion: "ACTUALIZAR",
        entidad: "usuario",
        entidadId: guardado.id,
        descripcion: `Se actualizaron los datos del usuario ${guardado.username}.`
      });

      return respuestaUsuario(guardado, rol ?? undefined);
    });
  } catch (error) {
    if (error instanceof ErrorServicio) throw error;

    if ((error as { code?: string })?.code === "23505") {
      throw new ErrorServicio(409, "El username ya está registrado.");
    }

    throw error;
  }
}

export async function desactivarUsuario(
  administradorSub: string,
  id: number
) {
  validarId(id);

  const administradorId = convertirUsuarioId(administradorSub);

  if (id === administradorId) {
    throw new ErrorServicio(
      400,
      "No puedes desactivar tu propia cuenta."
    );
  }

  return AppDataSource.transaction(async manager => {
    const repositorio = manager.getRepository(Usuario);
    const usuario = await repositorio.findOneBy({ id });

    if (!usuario) {
      throw new ErrorServicio(404, "Usuario no encontrado.");
    }

    if (usuario.estado === "INACTIVO") {
      throw new ErrorServicio(400, "El usuario ya está inactivo.");
    }

    usuario.estado = "INACTIVO";
    const guardado = await repositorio.save(usuario);

    await registrarAuditoria(manager, {
      usuarioId: administradorId,
      accion: "DESACTIVAR",
      entidad: "usuario",
      entidadId: guardado.id,
      descripcion: `Se desactivó el usuario ${guardado.username}.`
    });

    return {
      mensaje: "Usuario desactivado correctamente.",
      usuario: {
        id: guardado.id,
        username: guardado.username,
        estado: guardado.estado
      }
    };
  });
}

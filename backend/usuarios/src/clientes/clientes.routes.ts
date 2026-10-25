import { Router, Response, NextFunction } from "express";

import { AppDataSource } from "../config/database";
import { Cliente } from "../model/entities/Cliente";

import {
  autenticar,
  RequestAutenticado
} from "../middleware/autenticar";

import { autorizar } from "../middleware/autorizar";

const router = Router();

/*
|--------------------------------------------------------------------------
| VALIDACIONES
|--------------------------------------------------------------------------
*/

function validarNombre(nombre: string): boolean {
  return /^[\p{L}][\p{L}\s'-]{0,49}$/u.test(nombre);
}

function validarTelefono(telefono: string): boolean {
  return (
    telefono === "" ||
    /^[0-9+\-()\s]{7,15}$/.test(telefono)
  );
}

function esObjetoValido(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function textoRecortado(
  valor: unknown
): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  return valor.trim();
}

/*
|--------------------------------------------------------------------------
| GET /clientes
|--------------------------------------------------------------------------
| Permisos:
| - ADMINISTRADOR
| - OPERADOR
|
| Lista los perfiles de clientes sin exponer hashes de contraseñas.
|--------------------------------------------------------------------------
*/

router.get(
  "/clientes",
  autenticar,
  autorizar("ADMINISTRADOR", "OPERADOR"),
  async (_req, res, next) => {
    try {
      const clientes = await AppDataSource
        .getRepository(Cliente)
        .find({
          select: {
            id: true,
            usuarioId: true,
            primerNombre: true,
            segundoNombre: true,
            apellido: true,
            dni: true,
            nacionalidad: true,
            direccion: true,
            telefono: true,
            correo: true
          },
          order: {
            id: "ASC"
          }
        });

      return res.status(200).json({
        total: clientes.length,
        clientes
      });
    } catch (error) {
      return next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /clientes/me
|--------------------------------------------------------------------------
| Devuelve el perfil del cliente asociado al usuario autenticado.
|--------------------------------------------------------------------------
*/

router.get(
  "/clientes/me",
  autenticar,
  async (
    req: RequestAutenticado,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const usuarioId = Number(req.auth?.sub);

      if (
        !Number.isSafeInteger(usuarioId) ||
        usuarioId <= 0
      ) {
        return res.status(401).json({
          error: "Token de autenticación inválido."
        });
      }

      const cliente = await AppDataSource
        .getRepository(Cliente)
        .findOne({
          where: {
            usuarioId
          },
          select: {
            id: true,
            usuarioId: true,
            primerNombre: true,
            segundoNombre: true,
            apellido: true,
            dni: true,
            nacionalidad: true,
            direccion: true,
            telefono: true,
            correo: true
          }
        });

      if (!cliente) {
        return res.status(404).json({
          error:
            "No existe un perfil de cliente asociado a este usuario."
        });
      }

      return res.status(200).json(cliente);
    } catch (error) {
      return next(error);
    }
  }
);

/*
|--------------------------------------------------------------------------
| PUT /clientes/me
|--------------------------------------------------------------------------
| Actualiza únicamente los datos personales permitidos.
|
| No permite cambiar:
| - DNI
| - Correo
| - Usuario
| - Rol
| - Estado
| - Contraseña
|--------------------------------------------------------------------------
*/

router.put(
  "/clientes/me",
  autenticar,
  async (
    req: RequestAutenticado,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const usuarioId = Number(req.auth?.sub);

      if (
        !Number.isSafeInteger(usuarioId) ||
        usuarioId <= 0
      ) {
        return res.status(401).json({
          error: "Token de autenticación inválido."
        });
      }

      if (!esObjetoValido(req.body)) {
        return res.status(400).json({
          error: "El cuerpo de la petición debe ser un objeto JSON."
        });
      }

      const body = req.body;

      const camposPermitidos = [
        "primerNombre",
        "segundoNombre",
        "apellido",
        "nacionalidad",
        "direccion",
        "telefono"
      ];

      const camposRecibidos = Object.keys(body);

      if (
        camposRecibidos.length === 0 ||
        camposRecibidos.some(
          campo => !camposPermitidos.includes(campo)
        )
      ) {
        return res.status(400).json({
          error:
            "La petición está vacía o contiene campos no permitidos.",
          camposPermitidos
        });
      }

      const repo = AppDataSource.getRepository(Cliente);

      /*
       * La búsqueda se realiza por usuarioId.
       * Nunca se acepta un clienteId enviado por el usuario.
       */
      const cliente = await repo.findOneBy({
        usuarioId
      });

      if (!cliente) {
        return res.status(404).json({
          error:
            "No existe un perfil de cliente asociado a este usuario."
        });
      }

      /*
       * Los campos omitidos conservan su valor actual.
       * Los campos de texto opcionales admiten "" para vaciarlos.
       */

      let primerNombre = cliente.primerNombre;
      let segundoNombre = cliente.segundoNombre ?? "";
      let apellido = cliente.apellido;
      let nacionalidad = cliente.nacionalidad ?? "";
      let direccion = cliente.direccion ?? "";
      let telefono = cliente.telefono ?? "";

      if (body.primerNombre !== undefined) {
        const valor = textoRecortado(body.primerNombre);

        if (valor === null) {
          return res.status(400).json({
            error: "primerNombre debe ser un texto."
          });
        }

        primerNombre = valor;
      }

      if (body.segundoNombre !== undefined) {
        const valor = textoRecortado(body.segundoNombre);

        if (valor === null) {
          return res.status(400).json({
            error: "segundoNombre debe ser un texto."
          });
        }

        segundoNombre = valor;
      }

      if (body.apellido !== undefined) {
        const valor = textoRecortado(body.apellido);

        if (valor === null) {
          return res.status(400).json({
            error: "apellido debe ser un texto."
          });
        }

        apellido = valor;
      }

      if (body.nacionalidad !== undefined) {
        const valor = textoRecortado(body.nacionalidad);

        if (valor === null) {
          return res.status(400).json({
            error: "nacionalidad debe ser un texto."
          });
        }

        nacionalidad = valor;
      }

      if (body.direccion !== undefined) {
        const valor = textoRecortado(body.direccion);

        if (valor === null) {
          return res.status(400).json({
            error: "direccion debe ser un texto."
          });
        }

        direccion = valor;
      }

      if (body.telefono !== undefined) {
        const valor = textoRecortado(body.telefono);

        if (valor === null) {
          return res.status(400).json({
            error: "telefono debe ser un texto."
          });
        }

        telefono = valor;
      }

      /*
       * Validación de nombres.
       */

      if (
        !validarNombre(primerNombre) ||
        !validarNombre(apellido) ||
        (
          segundoNombre !== "" &&
          !validarNombre(segundoNombre)
        )
      ) {
        return res.status(400).json({
          error:
            "Los nombres deben contener letras y tener entre 1 y 50 caracteres."
        });
      }

      /*
       * Validación de nacionalidad y dirección.
       */

      if (
        nacionalidad.length > 50 ||
        direccion.length > 200
      ) {
        return res.status(400).json({
          error:
            "La nacionalidad no puede superar 50 caracteres y la dirección no puede superar 200."
        });
      }

      /*
       * Validación del teléfono.
       */

      if (!validarTelefono(telefono)) {
        return res.status(400).json({
          error:
            "El teléfono no tiene un formato válido."
        });
      }

      /*
       * Solo se modifican las propiedades permitidas.
       */

      cliente.primerNombre = primerNombre;
      cliente.segundoNombre = segundoNombre || null;
      cliente.apellido = apellido;
      cliente.nacionalidad = nacionalidad || null;
      cliente.direccion = direccion || null;
      cliente.telefono = telefono || null;

      await repo.save(cliente);

      /*
       * No se devuelve ningún campo de autenticación.
       */

      return res.status(200).json({
        mensaje: "Perfil actualizado correctamente.",
        cliente: {
          id: cliente.id,
          usuarioId: cliente.usuarioId,
          primerNombre: cliente.primerNombre,
          segundoNombre: cliente.segundoNombre,
          apellido: cliente.apellido,
          dni: cliente.dni,
          nacionalidad: cliente.nacionalidad,
          direccion: cliente.direccion,
          telefono: cliente.telefono,
          correo: cliente.correo
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
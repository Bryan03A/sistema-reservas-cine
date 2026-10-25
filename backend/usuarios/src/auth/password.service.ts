import bcrypt from "bcryptjs";
import { AppDataSource } from "../config/database";
import { Usuario } from "../model/entities/Usuario";

export async function cambiarPassword(
  usuarioId: number,
  passwordActual: string,
  passwordNueva: string
): Promise<void> {
  if (
    !passwordActual ||
    typeof passwordActual !== "string" ||
    typeof passwordNueva !== "string" ||
    passwordNueva.length < 12 ||
    passwordNueva.length > 72
  ) {
    throw Object.assign(
      new Error(
        "La contraseña nueva debe tener entre 12 y 72 caracteres."
      ),
      { status: 400 }
    );
  }

  const repo = AppDataSource.getRepository(Usuario);

  const usuario = await repo.findOneBy({
    id: usuarioId
  });

  if (!usuario) {
    throw Object.assign(
      new Error("Usuario no encontrado."),
      { status: 404 }
    );
  }

  const coincide = await bcrypt.compare(
    passwordActual,
    usuario.passwordHash
  );

  if (!coincide) {
    throw Object.assign(
      new Error("La contraseña actual es incorrecta."),
      { status: 401 }
    );
  }

  const coincideNueva = await bcrypt.compare(
    passwordNueva,
    usuario.passwordHash
  );

  if (coincideNueva) {
    throw Object.assign(
      new Error(
        "La nueva contraseña debe ser diferente de la actual."
      ),
      { status: 400 }
    );
  }

  usuario.passwordHash = await bcrypt.hash(
    passwordNueva,
    12
  );

  await repo.save(usuario);
}
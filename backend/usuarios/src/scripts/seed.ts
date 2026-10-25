
import "../config/env";
import bcrypt from "bcryptjs";

import { AppDataSource } from "../config/database";
import { Rol } from "../model/entities/Rol";
import { Usuario } from "../model/entities/Usuario";
import { Cliente } from "../model/entities/Cliente";

export async function ejecutarSemilla(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const rolRepo = AppDataSource.getRepository(Rol);
  const usuarioRepo = AppDataSource.getRepository(Usuario);
  const clienteRepo = AppDataSource.getRepository(Cliente);

  // Roles iniciales del sistema.
  const rolesIniciales = [
    {
      nombre: "ADMINISTRADOR",
      descripcion: "Control completo del sistema"
    },
    {
      nombre: "OPERADOR",
      descripcion: "Consulta y validación de boletos"
    },
    {
      nombre: "CLIENTE",
      descripcion: "Consulta y reserva de asientos"
    }
  ];

  // Cuentas de prueba.
  const cuentas = [
    {
      username: "admin",
      correo: "admin@cine.local",
      password: process.env.SEED_ADMIN_PASSWORD,
      rol: "ADMINISTRADOR",
      primerNombre: "Administrador",
      segundoNombre: "Principal",
      apellido: "Sistema",
      dni: "1790000001",
      nacionalidad: "Ecuatoriana",
      direccion: "Oficina administrativa del sistema",
      telefono: "0990000001"
    },
    {
      username: "operador",
      correo: "operador@cine.local",
      password: process.env.SEED_OPERATOR_PASSWORD,
      rol: "OPERADOR",
      primerNombre: "Operador",
      segundoNombre: "Principal",
      apellido: "Sistema",
      dni: "1790000002",
      nacionalidad: "Ecuatoriana",
      direccion: "Oficina de operaciones del cine",
      telefono: "0990000002"
    },
    {
      username: "cliente1",
      correo: "cliente1@cine.local",
      password: process.env.SEED_CLIENT1_PASSWORD,
      rol: "CLIENTE",
      primerNombre: "Cliente",
      segundoNombre: "Demo",
      apellido: "Uno",
      dni: "1790000003",
      nacionalidad: "Ecuatoriana",
      direccion: "Quito, Ecuador",
      telefono: "0990000003"
    },
    {
      username: "cliente2",
      correo: "cliente2@cine.local",
      password: process.env.SEED_CLIENT2_PASSWORD,
      rol: "CLIENTE",
      primerNombre: "Cliente",
      segundoNombre: "Demo",
      apellido: "Dos",
      dni: "1790000004",
      nacionalidad: "Ecuatoriana",
      direccion: "Quito, Ecuador",
      telefono: "0990000004"
    }
  ];

  // Validar las contraseñas antes de modificar la base de datos.
  for (const cuenta of cuentas) {
    if (!cuenta.password) {
      throw new Error(
        `Falta la contraseña de semilla para ${cuenta.username}.`
      );
    }
  }

  await AppDataSource.manager.transaction(async manager => {
    const rolRepoTx = manager.getRepository(Rol);
    const usuarioRepoTx = manager.getRepository(Usuario);
    const clienteRepoTx = manager.getRepository(Cliente);

    // 1. Crear los roles que no existan.
    // Si ya existen, se conservan sin modificarlos.
    for (const datos of rolesIniciales) {
      const existente = await rolRepoTx.findOneBy({
        nombre: datos.nombre
      });

      if (existente) {
        console.log(
          `Semilla: rol ${datos.nombre} ya existe; se conserva.`
        );
        continue;
      }

      await rolRepoTx.save(
        rolRepoTx.create({
          ...datos,
          estado: "ACTIVO"
        })
      );

      console.log(`Semilla: creado rol ${datos.nombre}.`);
    }

    // Consultar los roles disponibles.
    const roles = await rolRepoTx.find();

    const rolPorNombre = new Map(
      roles.map(rol => [rol.nombre, rol])
    );

    // 2. Crear únicamente las cuentas que no existan.
    for (const cuenta of cuentas) {
      const usuarioExistente = await usuarioRepoTx.findOneBy({
        username: cuenta.username
      });

      // Si existe el usuario, no modificar nada relacionado con él.
      if (usuarioExistente) {
        console.log(
          `Semilla: ${cuenta.username} ya existe; se omite por completo.`
        );
        continue;
      }

      const rol = rolPorNombre.get(cuenta.rol);

      if (!rol) {
        throw new Error(
          `No existe el rol ${cuenta.rol}.`
        );
      }

      // Verificar que el correo y el DNI estén disponibles
      // para los nuevos clientes.
      if (cuenta.rol === "CLIENTE") {
        const correoExistente = await clienteRepoTx.findOneBy({
          correo: cuenta.correo
        });

        if (correoExistente) {
          throw new Error(
            `El correo ${cuenta.correo} ya está registrado.`
          );
        }

        const dniExistente = await clienteRepoTx.findOneBy({
          dni: cuenta.dni
        });

        if (dniExistente) {
          throw new Error(
            `El DNI ${cuenta.dni} ya está registrado.`
          );
        }
      }

      // Generar el hash de la contraseña.
      const passwordHash = await bcrypt.hash(
        cuenta.password!,
        12
      );

      // Crear el usuario y, si corresponde, su perfil de cliente
      // dentro de la misma transacción.
      const nuevoUsuario = await manager.save(
        Usuario,
        manager.create(Usuario, {
          username: cuenta.username,
          passwordHash,
          rolId: rol.id,
          estado: "ACTIVO",
          ultimaConexion: null
        })
      );

      if (cuenta.rol === "CLIENTE") {
        await manager.save(
          Cliente,
          manager.create(Cliente, {
            usuarioId: nuevoUsuario.id,
            primerNombre: cuenta.primerNombre,
            segundoNombre: cuenta.segundoNombre,
            apellido: cuenta.apellido,
            dni: cuenta.dni,
            nacionalidad: cuenta.nacionalidad,
            direccion: cuenta.direccion,
            telefono: cuenta.telefono,
            correo: cuenta.correo
          })
        );
      }

      console.log(
        `Semilla: creada cuenta ${nuevoUsuario.username} (${cuenta.rol}).`
      );
    }
  });

  console.log("Semilla completada correctamente.");
}

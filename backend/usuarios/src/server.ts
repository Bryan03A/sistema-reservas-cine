import "./config/env";
import app from "./app";
import { AppDataSource } from "./config/database";
import { ejecutarSemilla } from "./scripts/seed";

async function iniciarServidor() {
  try {
    await AppDataSource.initialize();
    console.log("Conexión a cine_usuarios establecida.");

    await ejecutarSemilla();

    const port = Number(process.env.PORT ?? 3000);

    app.listen(port, () => {
      console.log(`Servicio de autenticación disponible en http://localhost:${port}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servicio:", error);
    process.exit(1);
  }
}

iniciarServidor();
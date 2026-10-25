import { config } from './config.js';
import { connectWithRetry } from './db.js';
import { syncModels } from './model/entities/index.js';
import { seed } from './seed.js';
import { buildApp } from './app.js';
import { expirarVencidas } from './servicio.js';

await connectWithRetry();
await syncModels();
await seed();

// Tarea programada: cancela reservas sin confirmar y libera sus asientos
setInterval(() => expirarVencidas().catch((e) => console.error('[reservas] error al expirar:', e.message)), config.expiracionCadaSegundos * 1000);

buildApp().listen(config.port, () => {
  console.log(`[reservas] escuchando en http://localhost:${config.port}  (Swagger: /docs) · TTL de reserva: ${config.reservaTtlSeconds}s`);
});

import { config } from './config.js';
import { connectWithRetry } from './db.js';
import { syncModels } from './model/entities/index.js';
import { initKeys } from './security.js';
import { seed } from './seed.js';
import { buildApp } from './app.js';

await connectWithRetry();
await syncModels();
await initKeys();
await seed();

buildApp().listen(config.port, () => {
  console.log(`[usuarios] escuchando en http://localhost:${config.port}  (Swagger: /docs)`);
});

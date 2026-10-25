import { Sequelize } from 'sequelize';
import { config } from './config.js';

export const sequelize = new Sequelize(config.databaseUrl, { logging: false });

export async function connectWithRetry(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await sequelize.authenticate();
      return;
    } catch (e) {
      console.log(`[reservas] esperando base de datos (${i}/${retries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a la base de datos');
}

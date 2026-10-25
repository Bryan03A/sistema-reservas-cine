import { Reserva, AsientoFuncion, Boleto } from './model/entities/index.js';
import { nuevoTokenQr } from './servicio.js';

// Archivo semilla: datos coherentes con las semillas de Usuarios (cliente 3 = cliente1, 4 = cliente2)
// y Películas (función 1 y 2 en Sala 1; asientos 1-2 = VIP A1-A2). Solo corre si la tabla está vacía.
export async function seed() {
  if ((await Reserva.count()) > 0) return;
  console.log('[reservas] cargando datos semilla...');
  const r1 = await Reserva.create({ codigo: 'RSV-DEMO-0001', cliente_id: 3, funcion_id: 1, estado: 'CONFIRMADA', cantidad_boletos: 2, total: 30, confirmada_en: new Date() });
  const af1 = await AsientoFuncion.bulkCreate([
    { funcion_id: 1, asiento_id: 1, reserva_id: r1.id, estado: 'OCUPADO' },
    { funcion_id: 1, asiento_id: 2, reserva_id: r1.id, estado: 'OCUPADO' },
  ]);
  await Boleto.bulkCreate(af1.map((a, i) => ({ reserva_id: r1.id, asiento_funcion_id: a.id, asiento_id: a.asiento_id, precio: 15, codigo_qr: nuevoTokenQr(), etiqueta: `A${i + 1}`, seccion_tipo: 'VIP' })));
  const r2 = await Reserva.create({ codigo: 'RSV-DEMO-0002', cliente_id: 4, funcion_id: 2, estado: 'CANCELADA', cantidad_boletos: 1, total: 5, cancelada_en: new Date() });
  const af2 = await AsientoFuncion.create({ funcion_id: 2, asiento_id: 30, estado: 'DISPONIBLE' });
  await Boleto.create({ reserva_id: r2.id, asiento_funcion_id: af2.id, asiento_id: 30, precio: 5, codigo_qr: nuevoTokenQr(), etiqueta: 'E3', seccion_tipo: 'GENERAL', estado: 'ANULADO' });
  console.log('[reservas] semilla lista: 2 reservas de ejemplo');
}

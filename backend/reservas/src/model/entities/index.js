// Capa model/entities: cada entidad se mapea a su tabla espejo mediante el ORM (Sequelize).
// Las referencias a cliente, función y asiento son IDs lógicos de OTROS microservicios (sin FK física).
import { DataTypes, Op } from 'sequelize';
import { sequelize } from '../../db.js';

export const Reserva = sequelize.define('Reserva', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },   // → usuarios.cliente
  funcion_id: { type: DataTypes.INTEGER, allowNull: false },   // → peliculas.funcion
  gestionado_por: { type: DataTypes.INTEGER },                 // → usuarios.usuario (si la creó el personal)
  fecha_reserva: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  expira_en: { type: DataTypes.DATE },
  estado: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'PENDIENTE' }, // PENDIENTE|CONFIRMADA|CANCELADA|EXPIRADA|USADA
  cantidad_boletos: { type: DataTypes.INTEGER, allowNull: false },
  total: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  moneda: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'USD' },
  confirmada_en: { type: DataTypes.DATE },
  cancelada_en: { type: DataTypes.DATE },
}, { tableName: 'reserva', timestamps: false, indexes: [{ fields: ['cliente_id'] }, { fields: ['funcion_id'] }, { fields: ['estado', 'expira_en'] }] });

export const AsientoFuncion = sequelize.define('AsientoFuncion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  funcion_id: { type: DataTypes.INTEGER, allowNull: false },
  asiento_id: { type: DataTypes.INTEGER, allowNull: false },   // → peliculas.asiento
  reserva_id: { type: DataTypes.INTEGER },
  estado: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'DISPONIBLE' }, // DISPONIBLE|RESERVADO|OCUPADO
  bloqueado_hasta: { type: DataTypes.DATE },
}, { tableName: 'asiento_funcion', timestamps: false, indexes: [{ unique: true, fields: ['funcion_id', 'asiento_id'] }, { fields: ['reserva_id'] }, { fields: ['estado', 'bloqueado_hasta'] }] });

export const Boleto = sequelize.define('Boleto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reserva_id: { type: DataTypes.INTEGER, allowNull: false },
  asiento_funcion_id: { type: DataTypes.INTEGER, allowNull: false },
  asiento_id: { type: DataTypes.INTEGER, allowNull: false },
  precio: { type: DataTypes.DECIMAL(6, 2), allowNull: false },
  codigo_qr: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  estado: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ACTIVO' }, // ACTIVO|USADO|ANULADO
  emitido_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  usado_en: { type: DataTypes.DATE },
  // Copia de datos del asiento al emitir el boleto (ajuste al ER): el boleto se muestra sin depender de Películas.
  etiqueta: { type: DataTypes.STRING(10), allowNull: false },
  seccion_tipo: { type: DataTypes.STRING(10), allowNull: false },
}, {
  tableName: 'boleto', timestamps: false,
  // Un asiento de una función solo puede tener UN boleto vigente. Los boletos ANULADOS (reserva cancelada) se conservan
  // como historial, por eso la unicidad es parcial: así el asiento puede volver a reservarse tras una cancelación.
  indexes: [{ name: 'uq_boleto_vigente_por_asiento', unique: true, fields: ['asiento_funcion_id'], where: { estado: { [Op.ne]: 'ANULADO' } } }],
});

Reserva.hasMany(AsientoFuncion, { foreignKey: 'reserva_id' });
AsientoFuncion.belongsTo(Reserva, { foreignKey: 'reserva_id' });
Reserva.hasMany(Boleto, { foreignKey: 'reserva_id' });
Boleto.belongsTo(Reserva, { foreignKey: 'reserva_id' });
AsientoFuncion.hasOne(Boleto, { foreignKey: 'asiento_funcion_id' });
Boleto.belongsTo(AsientoFuncion, { foreignKey: 'asiento_funcion_id' });

export async function syncModels() {
  await sequelize.sync();
}

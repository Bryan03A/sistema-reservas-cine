// Capa model/entities: cada entidad se mapea a su tabla espejo mediante el ORM (Sequelize).
import { DataTypes } from 'sequelize';
import { sequelize } from '../../db.js';

export const Rol = sequelize.define('Rol', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(150) },
  estado: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ACTIVO' },
}, { tableName: 'rol', timestamps: false });

export const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  rol_id: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ACTIVO' },
  ultima_conexion: { type: DataTypes.DATE },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'usuario', timestamps: false });

export const Cliente = sequelize.define('Cliente', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  primer_nombre: { type: DataTypes.STRING(50), allowNull: false },
  segundo_nombre: { type: DataTypes.STRING(50) },
  apellido: { type: DataTypes.STRING(50), allowNull: false },
  dni: { type: DataTypes.STRING(13), allowNull: false, unique: true },
  nacionalidad: { type: DataTypes.STRING(50) },
  direccion: { type: DataTypes.STRING(200) },
  telefono: { type: DataTypes.STRING(15) },
  correo: { type: DataTypes.STRING(120), allowNull: false, unique: true },
}, { tableName: 'cliente', timestamps: false });

export const RegistroAuditoria = sequelize.define('RegistroAuditoria', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  accion: { type: DataTypes.STRING(30), allowNull: false },
  entidad: { type: DataTypes.STRING(50), allowNull: false },
  entidad_id: { type: DataTypes.INTEGER },
  descripcion: { type: DataTypes.TEXT },
  fecha_accion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'registro_auditoria', timestamps: false });

// Foto de perfil en tabla aparte (1 a 1 con cliente) para no cargar imágenes al consultar usuarios
export const ClienteFoto = sequelize.define('ClienteFoto', {
  cliente_id: { type: DataTypes.INTEGER, primaryKey: true },
  contenido: { type: DataTypes.BLOB, allowNull: false },
  tipo: { type: DataTypes.STRING(20), allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  actualizado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'cliente_foto', timestamps: false });

Rol.hasMany(Usuario, { foreignKey: 'rol_id' });
Usuario.belongsTo(Rol, { foreignKey: 'rol_id' });
Usuario.hasOne(Cliente, { foreignKey: 'usuario_id' });
Cliente.belongsTo(Usuario, { foreignKey: 'usuario_id' });
Cliente.hasOne(ClienteFoto, { foreignKey: 'cliente_id', onDelete: 'CASCADE' });
Usuario.hasMany(RegistroAuditoria, { foreignKey: 'usuario_id' });
RegistroAuditoria.belongsTo(Usuario, { foreignKey: 'usuario_id' });

export async function syncModels() {
  await sequelize.sync();
}

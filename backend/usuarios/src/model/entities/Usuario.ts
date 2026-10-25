import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: "usuario" })
export class Usuario {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Index({ unique: true })
  @Column({ name: "username", type: "varchar", length: 50, unique: true })
  username!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ name: "rol_id", type: "int" })
  rolId!: number;

  @Column({
    name: "estado",
    type: "varchar",
    length: 10,
    default: "ACTIVO"
  })
  estado!: string;

  @Column({
    name: "ultima_conexion",
    type: "timestamptz",
    nullable: true
  })
  ultimaConexion!: Date | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "NOW()"
  })
  createdAt!: Date;
}

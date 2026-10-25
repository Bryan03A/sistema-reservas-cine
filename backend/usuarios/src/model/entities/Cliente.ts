
import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

@Entity({ name: "cliente" })
export class Cliente {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Index({ unique: true })
  @Column({ name: "usuario_id", type: "int", unique: true })
  usuarioId!: number;

  @Column({ name: "primer_nombre", type: "varchar", length: 50 })
  primerNombre!: string;

  @Column({
    name: "segundo_nombre",
    type: "varchar",
    length: 50,
    nullable: true
  })
  segundoNombre!: string | null;

  @Column({ name: "apellido", type: "varchar", length: 50 })
  apellido!: string;

  @Index({ unique: true })
  @Column({ name: "dni", type: "varchar", length: 13, unique: true })
  dni!: string;

  @Column({
    name: "nacionalidad",
    type: "varchar",
    length: 50,
    nullable: true
  })
  nacionalidad!: string | null;

  @Column({
    name: "direccion",
    type: "varchar",
    length: 200,
    nullable: true
  })
  direccion!: string | null;

  @Column({
    name: "telefono",
    type: "varchar",
    length: 15,
    nullable: true
  })
  telefono!: string | null;

  @Index({ unique: true })
  @Column({ name: "correo", type: "varchar", length: 120, unique: true })
  correo!: string;
}

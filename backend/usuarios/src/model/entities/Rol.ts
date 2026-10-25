
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: "rol" })
export class Rol {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "nombre", type: "varchar", length: 30, unique: true })
  nombre!: string;

  @Column({
    name: "descripcion",
    type: "varchar",
    length: 150,
    nullable: true
  })
  descripcion!: string | null;

  @Column({
    name: "estado",
    type: "varchar",
    length: 10,
    default: "ACTIVO"
  })
  estado!: string;
}

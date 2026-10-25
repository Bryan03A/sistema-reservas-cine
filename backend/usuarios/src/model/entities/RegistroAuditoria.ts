
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn
} from "typeorm";

@Entity({ name: "registro_auditoria" })
export class RegistroAuditoria {
  @PrimaryGeneratedColumn({ name: "id", type: "int" })
  id!: number;

  @Column({ name: "usuario_id", type: "int" })
  usuarioId!: number;

  @Column({ name: "accion", type: "varchar", length: 30 })
  accion!: string;

  @Column({ name: "entidad", type: "varchar", length: 50 })
  entidad!: string;

  @Column({ name: "entidad_id", type: "int", nullable: true })
  entidadId!: number | null;

  @Column({ name: "descripcion", type: "text", nullable: true })
  descripcion!: string | null;

  @CreateDateColumn({
    name: "fecha_accion",
    type: "timestamptz",
    default: () => "NOW()"
  })
  fechaAccion!: Date;
}

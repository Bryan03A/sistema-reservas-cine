import { EntityManager } from "typeorm";
import { RegistroAuditoria } from "../model/entities/RegistroAuditoria";

export interface DatosAuditoria {
  usuarioId: number;
  accion: string;
  entidad: string;
  entidadId?: number | null;
  descripcion?: string | null;
}

export async function registrarAuditoria(
  manager: EntityManager,
  datos: DatosAuditoria
): Promise<RegistroAuditoria> {
  const repositorio = manager.getRepository(RegistroAuditoria);

  const registro = repositorio.create({
    usuarioId: datos.usuarioId,
    accion: datos.accion,
    entidad: datos.entidad,
    entidadId: datos.entidadId ?? null,
    descripcion: datos.descripcion ?? null
  });

  return repositorio.save(registro);
}

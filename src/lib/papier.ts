import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Agent « sans accès » : sans outil informatique, ou ne s'est jamais connecté (code provisoire jamais remplacé). */
export const sansAcces = (a: { email: string | null; codeProvisoire: string | null; profilAcces: string }) =>
  a.profilAcces === "sans_outil" || (a.profilAcces === "auto" && !a.email) || !!a.codeProvisoire;

/** Dossiers dont l'étape en cours est un visa d'agent sans accès informatique. */
export async function dossiersPapier(campagneId: number) {
  const es = await db
    .select({ e: schema.entretiens, a: schema.agents })
    .from(schema.entretiens)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.entretiens.agentId))
    .where(and(eq(schema.entretiens.campagneId, campagneId), eq(schema.entretiens.statut, "circuit")));
  if (!es.length) return [];
  const ets = await db
    .select()
    .from(schema.etapes)
    .where(inArray(schema.etapes.entretienId, es.map((x) => x.e.id)))
    .orderBy(asc(schema.etapes.ordre));
  return es
    .filter(({ e, a }) => sansAcces(a) && ets.some((t) => t.entretienId === e.id && t.ordre === e.etapeCourante && t.acteurId === e.agentId))
    .map(({ e, a }) => {
      const mes = ets.filter((t) => t.entretienId === e.id);
      return { e, a, final: mes[mes.length - 1]?.ordre === e.etapeCourante };
    });
}

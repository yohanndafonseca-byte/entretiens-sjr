import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Campagne affichée : celle demandée dans l'URL, sinon la plus récente ouverte, sinon la plus récente. */
export async function campagneChoisie(id?: string | null) {
  const toutes = await db.select().from(schema.campagnes).orderBy(desc(schema.campagnes.annee));
  const choisie = (id && toutes.find((c) => c.id === Number(id))) || toutes.find((c) => c.statut === "ouverte") || toutes[0] || null;
  return { toutes, choisie };
}

export async function campagneParId(id: number) {
  const [c] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, id));
  return c ?? null;
}

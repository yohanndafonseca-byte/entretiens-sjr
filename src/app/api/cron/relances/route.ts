import { NextResponse } from "next/server";
import { and, eq, ne, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { journaliser, notifierTour, pdfDuDossier } from "@/lib/workflow";
import { chargerDossier } from "@/lib/dossier";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Relances automatiques (appelée chaque matin par Vercel Cron, voir vercel.json).
 * Relance la personne qui doit agir si rien ne s'est passé depuis N jours (N = paramètre de la campagne),
 * puis au maximum une fois tous les N jours.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Non autorisé", { status: 401 });
  const camps = await db.select().from(schema.campagnes).where(eq(schema.campagnes.statut, "ouverte"));
  let n = 0;
  for (const c of camps) {
    const delai = c.relanceJours * 86_400_000;
    const es = await db
      .select()
      .from(schema.entretiens)
      .where(and(eq(schema.entretiens.campagneId, c.id), ne(schema.entretiens.statut, "termine")));
    for (const e of es) {
      const maintenant = Date.now();
      const inactif = maintenant - e.derniereActionLe.getTime() >= delai;
      const dejaRelance = e.derniereRelanceLe && maintenant - e.derniereRelanceLe.getTime() < delai;
      if (!inactif || dejaRelance) continue;
      await notifierTour(e.id, "relance");
      await db.update(schema.entretiens).set({ derniereRelanceLe: new Date() }).where(eq(schema.entretiens.id, e.id));
      await journaliser(e.id, null, "Relance automatique");
      n++;
    }
  }
  // Filet de sécurité : fige les PDF définitifs manquants (dossiers terminés), dans la limite de 3 minutes
  const debut = Date.now();
  const dejaFiges = db.select({ id: schema.pdfsDefinitifs.entretienId }).from(schema.pdfsDefinitifs);
  const manquants = await db
    .select({ id: schema.entretiens.id })
    .from(schema.entretiens)
    .where(and(eq(schema.entretiens.statut, "termine"), notInArray(schema.entretiens.id, dejaFiges)));
  let pdfs = 0;
  for (const m of manquants) {
    if (Date.now() - debut > 180_000) break;
    const d = await chargerDossier(m.id);
    if (d) {
      await pdfDuDossier(d);
      pdfs++;
    }
  }
  return NextResponse.json({ relances: n, pdfsFiges: pdfs, pdfsRestants: manquants.length - pdfs });
}

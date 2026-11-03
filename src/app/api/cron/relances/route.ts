import { NextResponse } from "next/server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { chargerDossier, libelleEtape, lignesListe, type LigneListe } from "@/lib/dossier";
import { envoyerEmail, urlApp } from "@/lib/emails";
import { journaliser, pdfDuDossier } from "@/lib/workflow";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Relances automatiques (appelée chaque matin de semaine par Vercel Cron, voir vercel.json).
 * Un dossier est relancé s'il est sans action depuis N jours (N = paramètre de la campagne), puis au plus tous les N jours.
 * Les relances sont REGROUPÉES : chaque personne reçoit un seul e-mail récapitulatif listant tous ses dossiers en attente.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Non autorisé", { status: 401 });
  const camps = await db.select().from(schema.campagnes).where(eq(schema.campagnes.statut, "ouverte"));
  const parPersonne = new Map<number, LigneListe[]>();
  const maintenant = Date.now();
  for (const c of camps) {
    const delai = c.relanceJours * 86_400_000;
    const lignes = (await lignesListe(undefined, c.id)).filter((l) => l.statut !== "termine" && l.acteurCourantId);
    const ids = lignes.map((l) => l.id);
    const relances = ids.length
      ? await db.select({ id: schema.entretiens.id, r: schema.entretiens.derniereRelanceLe }).from(schema.entretiens).where(inArray(schema.entretiens.id, ids))
      : [];
    const derniere = new Map(relances.map((x) => [x.id, x.r]));
    for (const l of lignes) {
      const inactif = maintenant - new Date(l.derniereActionLe).getTime() >= delai;
      const r = derniere.get(l.id);
      if (!inactif || (r && maintenant - r.getTime() < delai)) continue;
      const t = parPersonne.get(l.acteurCourantId!) ?? [];
      t.push(l);
      parPersonne.set(l.acteurCourantId!, t);
    }
  }
  let emails = 0;
  let dossiers = 0;
  const personnes = parPersonne.size ? await db.select().from(schema.agents).where(inArray(schema.agents.id, [...parPersonne.keys()])) : [];
  for (const p of personnes) {
    const liste = parPersonne.get(p.id)!;
    const lignesTxt = liste
      .map((l) => (l.agentId === p.id ? `- Votre propre compte rendu ${l.annee} : à viser` : `- ${l.agentNom} ${l.agentPrenom} (${l.service}) : ${libelleEtape(l).toLowerCase()}`))
      .join("\n");
    await envoyerEmail({
      to: p.email,
      type: "relance",
      sujet: `[Rappel] ${liste.length} entretien(s) professionnel(s) en attente de votre part`,
      corps: `Bonjour,\n\nLes dossiers suivants attendent une action de votre part :\n\n${lignesTxt}\n\nTout traiter : ${urlApp()}/${liste.length > 1 && liste.every((l) => l.statut === "circuit" && l.agentId !== p.id) ? "visas" : ""}\n\nMerci,\nLe service des Ressources Humaines`,
    });
    // même sans e-mail, la relance est notée (le tableau de bord « Qui bloque ? » signale ces personnes aux RH)
    for (const l of liste) {
      await db.update(schema.entretiens).set({ derniereRelanceLe: new Date() }).where(eq(schema.entretiens.id, l.id));
      await journaliser(l.id, null, "Relance automatique", p.email ? `E-mail récapitulatif à ${p.nom} ${p.prenom}` : `${p.nom} ${p.prenom} n'a pas d'e-mail`);
      dossiers++;
    }
    if (p.email) emails++;
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
  return NextResponse.json({ relances: dossiers, emails, pdfsFiges: pdfs, pdfsRestants: manquants.length - pdfs });
}

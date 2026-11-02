import "server-only";
import { and, asc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { chargerDossier, nomComplet, type Dossier } from "./dossier";
import { envoyerEmail, urlApp } from "./emails";
import { genererPdf, nomFichierPdf } from "./pdf";

export async function journaliser(entretienId: number | null, acteurId: number | null, action: string, details?: string) {
  await db.insert(schema.historique).values({ entretienId, acteurId, action, details });
}

/** Prévient par e-mail la personne qui doit agir maintenant sur le dossier. */
export async function notifierTour(entretienId: number, type: "tour" | "relance" = "tour") {
  const pre = type === "relance" ? "[Relance] " : "";
  const d = await chargerDossier(entretienId);
  if (!d) return;
  const lien = `${urlApp()}/entretiens/${entretienId}`;
  const agent = nomComplet(d.agent);
  if (d.entretien.statut === "redaction") {
    if (!d.redacteur?.email) return;
    await envoyerEmail({
      to: d.redacteur.email,
      type,
      entretienId,
      sujet: `${pre}Entretien professionnel ${d.campagne.annee} – ${agent} : compte rendu à rédiger`,
      corps: `Bonjour,\n\nLe compte rendu de l'entretien professionnel ${d.campagne.annee} de ${agent} est à rédiger (ou à reprendre).\n\nAccéder au dossier : ${lien}\n\nLe service des Ressources Humaines`,
    });
    return;
  }
  const c = d.etapeCourante;
  if (!c?.acteur.email) return;
  const pourAgent = c.estAgent;
  await envoyerEmail({
    to: c.acteur.email,
    type,
    entretienId,
    sujet: pre + (pourAgent
      ? `Votre compte rendu d'entretien professionnel ${d.campagne.annee} est à viser`
      : `Entretien professionnel ${d.campagne.annee} – ${agent} : visa attendu`),
    corps: pourAgent
      ? `Bonjour,\n\nVotre compte rendu d'entretien professionnel ${d.campagne.annee} est disponible. Vous pouvez en prendre connaissance, ajouter vos observations éventuelles puis le viser.\n\nAccéder à votre compte rendu : ${lien}\n\nLe service des Ressources Humaines`
      : `Bonjour,\n\nLe compte rendu d'entretien professionnel ${d.campagne.annee} de ${agent} attend votre visa.\n\nAccéder au dossier : ${lien}\n\nLe service des Ressources Humaines`,
  });
}

/** Passe à l'étape suivante non visée, ou termine le dossier. */
export async function avancer(entretienId: number, depuisOrdre: number) {
  const [suivante] = await db
    .select()
    .from(schema.etapes)
    .where(and(eq(schema.etapes.entretienId, entretienId), gt(schema.etapes.ordre, depuisOrdre)))
    .orderBy(asc(schema.etapes.ordre))
    .limit(1);
  if (suivante) {
    await db
      .update(schema.entretiens)
      .set({ etapeCourante: suivante.ordre, derniereActionLe: new Date(), derniereRelanceLe: null, updatedAt: new Date() })
      .where(eq(schema.entretiens.id, entretienId));
    await notifierTour(entretienId);
  } else {
    await finaliser(entretienId);
  }
}

/** Dernier visa posé : le compte rendu est définitif, on l'envoie à l'agent. */
export async function finaliser(entretienId: number) {
  await db
    .update(schema.entretiens)
    .set({ statut: "termine", termineLe: new Date(), derniereActionLe: new Date(), updatedAt: new Date() })
    .where(eq(schema.entretiens.id, entretienId));
  await journaliser(entretienId, null, "Terminé", "Tous les visas ont été recueillis. Compte rendu définitif.");
  await envoyerCompteRenduFinal(entretienId);
}

/**
 * PDF d'un dossier : pour un dossier terminé, la version figée au dernier visa (créée au besoin) ;
 * sinon une version provisoire générée à la volée.
 */
export async function pdfDuDossier(d: NonNullable<Dossier>): Promise<Buffer> {
  if (d.entretien.statut !== "termine") return genererPdf(d);
  const [stocke] = await db.select().from(schema.pdfsDefinitifs).where(eq(schema.pdfsDefinitifs.entretienId, d.entretien.id));
  if (stocke) return Buffer.from(stocke.contenu);
  const pdf = await genererPdf(d);
  await db.insert(schema.pdfsDefinitifs).values({ entretienId: d.entretien.id, contenu: pdf }).onConflictDoNothing();
  return pdf;
}

export async function envoyerCompteRenduFinal(entretienId: number) {
  const d = await chargerDossier(entretienId);
  if (!d) return false;
  const pdf = await pdfDuDossier(d);
  if (!d.agent.email) return false;
  const ok = await envoyerEmail({
    to: d.agent.email,
    type: "final",
    entretienId,
    sujet: `Votre compte rendu d'entretien professionnel ${d.campagne.annee} (version définitive)`,
    corps: `Bonjour,\n\nVous trouverez ci-joint la version définitive de votre compte rendu d'entretien professionnel ${d.campagne.annee}, visée par l'ensemble de votre ligne hiérarchique.\n\nLes voies et délais de recours figurent en dernière page du document.\n\nLe service des Ressources Humaines`,
    pieceJointe: { nom: nomFichierPdf(d), contenu: pdf },
  });
  await db.update(schema.entretiens).set({ pdfEnvoyeLe: new Date() }).where(eq(schema.entretiens.id, entretienId));
  return ok;
}

/** Remet le dossier en rédaction : tous les visas sont annulés (le contenu va changer). */
export async function remettreEnRedaction(entretienId: number, parId: number, motif: string) {
  await db.delete(schema.pdfsDefinitifs).where(eq(schema.pdfsDefinitifs.entretienId, entretienId));
  await db
    .update(schema.etapes)
    .set({ viseLe: null, observations: null, modeVisa: null, enregistreParId: null })
    .where(eq(schema.etapes.entretienId, entretienId));
  await db
    .update(schema.entretiens)
    .set({ statut: "redaction", etapeCourante: 0, visaRedacteurLe: null, termineLe: null, derniereActionLe: new Date(), derniereRelanceLe: null, updatedAt: new Date() })
    .where(eq(schema.entretiens.id, entretienId));
  await journaliser(entretienId, parId, "Renvoyé en rédaction", motif);
  await notifierTour(entretienId);
}

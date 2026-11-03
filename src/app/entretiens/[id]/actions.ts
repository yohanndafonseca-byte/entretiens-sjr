"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { exigerUtilisateur } from "@/lib/auth";
import { calculerDroits, chargerDossier } from "@/lib/dossier";
import { normaliserContenu, verifierCompletude, type ContenuCR } from "@/lib/formulaire";
import { avancer, journaliser, notifierTour, remettreEnRedaction } from "@/lib/workflow";
import { retirerDossier } from "@/app/admin/actions";
import { DELAI_CONVOCATION_JOURS, envoyerConvocation, joursAvant } from "@/lib/convocation";

type Resultat = { ok: true; message?: string } | { ok: false, erreur: string };

async function contexte(id: number) {
  const u = await exigerUtilisateur();
  const d = await chargerDossier(id);
  if (!d) throw new Error("Dossier introuvable.");
  return { u, d, droits: calculerDroits(u, d) };
}

/** Enregistrement automatique du brouillon (N+1 ou RH, pendant la rédaction). */
export async function enregistrerBrouillon(id: number, contenu: ContenuCR, dateEntretien: string | null): Promise<Resultat> {
  const { u, droits } = await contexte(id);
  if (!droits.editer) return { ok: false, erreur: "Ce compte rendu n'est plus modifiable." };
  await db
    .update(schema.entretiens)
    .set({ contenu: normaliserContenu(contenu), dateEntretien: dateEntretien || null, updatedAt: new Date(), derniereActionLe: new Date() })
    .where(eq(schema.entretiens.id, id));
  void u;
  return { ok: true };
}

/** Le N+1 vise son compte rendu : le circuit démarre. */
export async function viserRedaction(id: number, contenu: ContenuCR, dateEntretien: string | null): Promise<Resultat> {
  const { u, d, droits } = await contexte(id);
  if (!droits.editer) return { ok: false, erreur: "Action non autorisée." };
  const c = normaliserContenu(contenu);
  const manques = verifierCompletude(c, dateEntretien);
  if (manques.length) return { ok: false, erreur: "Le compte rendu est incomplet :\n• " + manques.join("\n• ") };
  if (!d.etapes.length) return { ok: false, erreur: "Aucun circuit de visa n'est défini pour cet agent. Contactez les RH." };
  await db
    .update(schema.entretiens)
    .set({
      contenu: c,
      dateEntretien,
      statut: "circuit",
      etapeCourante: d.etapes[0].ordre,
      visaRedacteurLe: new Date(),
      derniereActionLe: new Date(),
      derniereRelanceLe: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.entretiens.id, id));
  await journaliser(id, u.id, "Visa du responsable hiérarchique (rédacteur)", u.id === d.entretien.redacteurId ? undefined : "Visé par les RH pour le compte du N+1");
  await notifierTour(id);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Compte rendu visé et transmis." };
}

async function poserVisa(id: number, ordre: number, observations: string, mode: "en_ligne" | "en_presence" | "papier", parId: number, viseLe = new Date()) {
  await db
    .update(schema.etapes)
    .set({ viseLe, observations: observations.trim() || null, modeVisa: mode, enregistreParId: parId })
    .where(and(eq(schema.etapes.entretienId, id), eq(schema.etapes.ordre, ordre)));
}

export async function viser(id: number, observations: string): Promise<Resultat> {
  const { u, d, droits } = await contexte(id);
  if (!droits.viser || !d.etapeCourante) return { ok: false, erreur: "Ce n'est pas à vous de viser ce dossier." };
  await poserVisa(id, d.etapeCourante.ordre, observations, "en_ligne", u.id);
  await journaliser(id, u.id, "Visa", observations.trim() ? `Observations : ${observations.trim()}` : undefined);
  await avancer(id, d.etapeCourante.ordre);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Visa enregistré." };
}

/** L'agent vise sur le poste de son responsable : il saisit son propre code personnel. */
export async function viserEnPresence(id: number, motDePasseAgent: string, observations: string): Promise<Resultat> {
  const { u, d, droits } = await contexte(id);
  if (!droits.recueillirVisaPresence || !d.etapeCourante) return { ok: false, erreur: "Action non autorisée." };
  const agent = d.agent;
  if (agent.bloqueJusqua && agent.bloqueJusqua.getTime() > Date.now())
    return { ok: false, erreur: "Trop d'essais incorrects : le code de l'agent est bloqué 15 minutes. Les RH peuvent aussi enregistrer un visa papier." };
  if (!agent.passwordHash || !(await bcrypt.compare(motDePasseAgent, agent.passwordHash))) {
    const n = agent.tentativesEchouees + 1;
    await db
      .update(schema.agents)
      .set(n >= 5 ? { tentativesEchouees: 0, bloqueJusqua: new Date(Date.now() + 15 * 60_000) } : { tentativesEchouees: n })
      .where(eq(schema.agents.id, agent.id));
    return { ok: false, erreur: "Code personnel de l'agent incorrect." };
  }
  await db.update(schema.agents).set({ tentativesEchouees: 0, bloqueJusqua: null }).where(eq(schema.agents.id, agent.id));
  await poserVisa(id, d.etapeCourante.ordre, observations, "en_presence", u.id);
  await journaliser(id, agent.id, "Visa de l'agent (en présence)", `Recueilli sur le poste de ${u.nom} ${u.prenom}`);
  await avancer(id, d.etapeCourante.ordre);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Visa de l'agent enregistré." };
}

/** RH : enregistre un visa donné sur papier (agent sans accès informatique). */
export async function enregistrerVisaPapier(id: number, dateIso: string, observations: string): Promise<Resultat> {
  const { u, d } = await contexte(id);
  if (!u.isAdmin || !d.etapeCourante) return { ok: false, erreur: "Action réservée aux RH." };
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  await poserVisa(id, d.etapeCourante.ordre, observations, "papier", u.id, date);
  await journaliser(id, u.id, "Visa papier enregistré par les RH", `Pour ${d.etapeCourante.acteur.nom} ${d.etapeCourante.acteur.prenom}, daté du ${date.toLocaleDateString("fr-FR")}`);
  await avancer(id, d.etapeCourante.ordre);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Visa papier enregistré." };
}

export async function renvoyerEnRedaction(id: number, motif: string): Promise<Resultat> {
  const { u, droits } = await contexte(id);
  if (!droits.renvoyer) return { ok: false, erreur: "Action non autorisée." };
  if (!motif.trim()) return { ok: false, erreur: "Merci d'indiquer le motif du renvoi." };
  await remettreEnRedaction(id, u.id, motif.trim());
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Dossier renvoyé au rédacteur. Les visas déjà posés sont annulés." };
}

/** RH : rouvrir un dossier terminé (ex. révision acceptée). */
export async function rouvrir(id: number, motif: string): Promise<Resultat> {
  const { u, d } = await contexte(id);
  if (!u.isAdmin) return { ok: false, erreur: "Action réservée aux RH." };
  if (d.entretien.statut !== "termine") return { ok: false, erreur: "Le dossier n'est pas terminé." };
  if (!motif.trim()) return { ok: false, erreur: "Merci d'indiquer le motif." };
  await remettreEnRedaction(id, u.id, `Réouverture : ${motif.trim()}`);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Dossier rouvert en rédaction." };
}

export async function relancerMaintenant(id: number): Promise<Resultat> {
  const { u } = await contexte(id);
  if (!u.isAdmin) return { ok: false, erreur: "Action réservée aux RH." };
  await notifierTour(id, "relance");
  await db.update(schema.entretiens).set({ derniereRelanceLe: new Date() }).where(eq(schema.entretiens.id, id));
  await journaliser(id, u.id, "Relance manuelle");
  return { ok: true, message: "Relance envoyée (si la personne a une adresse e-mail)." };
}

export async function enregistrerRecours(
  id: number,
  r: { dateDemande: string; dateReponse: string; decision: string; saisineCapLe: string; avisCap: string; commentaire: string },
): Promise<Resultat> {
  const { u, d } = await contexte(id);
  if (!u.isAdmin) return { ok: false, erreur: "Action réservée aux RH." };
  const valeurs = {
    dateDemande: r.dateDemande || null,
    dateReponse: r.dateReponse || null,
    decision: r.decision || "en_cours",
    saisineCapLe: r.saisineCapLe || null,
    avisCap: r.avisCap || null,
    commentaire: r.commentaire || null,
  };
  if (d.recours[0]) await db.update(schema.recours).set(valeurs).where(eq(schema.recours.id, d.recours[0].id));
  else await db.insert(schema.recours).values({ entretienId: id, ...valeurs });
  await journaliser(id, u.id, "Recours mis à jour", `Décision : ${valeurs.decision}`);
  revalidatePath(`/entretiens/${id}`);
  return { ok: true, message: "Recours enregistré." };
}

export async function retirerDuCircuit(id: number): Promise<Resultat> {
  await exigerUtilisateur();
  const r = await retirerDossier(id);
  return r.ok ? { ok: true, message: r.message } : { ok: false, erreur: r.message };
}

/** Le N+1 (ou les RH) fixe la date de l'entretien et envoie la convocation (≥ 8 jours avant, décret 2014-1526). */
export async function convoquer(id: number, fd: FormData): Promise<Resultat> {
  const { u, d, droits } = await contexte(id);
  if (!droits.editer) return { ok: false, erreur: "Seul le responsable direct (ou les RH) peut convoquer." };
  const quand = String(fd.get("quand") ?? "");
  const lieu = String(fd.get("lieu") ?? "").trim();
  const motif = String(fd.get("motif") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(quand)) return { ok: false, erreur: "Indiquez la date et l'heure de l'entretien." };
  const jours = joursAvant(quand);
  if (jours < 0) return { ok: false, erreur: "La date est passée." };
  if (jours < DELAI_CONVOCATION_JOURS && !motif)
    return { ok: false, erreur: `Le décret prévoit une convocation au moins ${DELAI_CONVOCATION_JOURS} jours avant l'entretien (ici ${jours} jour(s)). Choisissez une date plus lointaine, ou indiquez le motif (ex. « date choisie d'un commun accord avec l'agent »).` };
  const fichier = fd.get("fichePoste");
  const maj: Partial<typeof schema.entretiens.$inferInsert> = { convocationLe: quand, convocationLieu: lieu || null, updatedAt: new Date(), derniereActionLe: new Date() };
  if (fichier instanceof File && fichier.size) {
    if (fichier.size > 5_000_000) return { ok: false, erreur: "La fiche de poste dépasse 5 Mo." };
    maj.fichePoste = Buffer.from(await fichier.arrayBuffer());
    maj.fichePosteNom = fichier.name;
  }
  await db.update(schema.entretiens).set(maj).where(eq(schema.entretiens.id, id));
  const r = await envoyerConvocation(id, u.id, jours < DELAI_CONVOCATION_JOURS ? motif : null);
  revalidatePath(`/entretiens/${id}`);
  void d;
  return {
    ok: true,
    message: r.emailAgent
      ? "Convocation envoyée à l'agent par e-mail (avec l'invitation agenda, la fiche d'entretien et la fiche de poste)."
      : "Entretien planifié. L'agent n'a pas d'e-mail : imprimez la convocation ci-dessous et remettez-la lui en main propre.",
  };
}

/** Visa en série (ligne hiérarchique) : chaque dossier est vérifié individuellement. */
export async function viserEnSerie(ids: number[]): Promise<Resultat> {
  const u = await exigerUtilisateur();
  let n = 0;
  for (const id of ids) {
    const d = await chargerDossier(id);
    if (!d?.etapeCourante || d.etapeCourante.acteurId !== u.id || d.etapeCourante.estAgent) continue;
    await poserVisa(id, d.etapeCourante.ordre, "", "en_ligne", u.id);
    await journaliser(id, u.id, "Visa", "Visa donné depuis la liste « Mes visas » (après lecture du résumé)");
    await avancer(id, d.etapeCourante.ordre);
    n++;
  }
  revalidatePath("/visas");
  return { ok: true, message: `${n} visa(s) enregistré(s).` };
}

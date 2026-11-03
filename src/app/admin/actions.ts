"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { exigerAdmin, genererCode } from "@/lib/auth";
import { lireTableur } from "@/lib/tableur";
import { creerOuMajDossier, importerAgents, importerCircuits, type Rapport } from "@/lib/imports";
import { genererDossiers, type LigneCircuit } from "@/lib/circuits";
import { avancer, journaliser, notifierTour } from "@/lib/workflow";

export type EtatImport = { rapport?: Rapport; erreur?: string } | undefined;

export async function actionImportAgents(_: EtatImport, fd: FormData): Promise<EtatImport> {
  const u = await exigerAdmin();
  const f = fd.get("fichier");
  if (!(f instanceof File) || !f.size) return { erreur: "Choisissez un fichier." };
  try {
    const rapport = await importerAgents(await lireTableur(f), u.id, fd.get("mode") === "apercu");
    revalidatePath("/admin", "layout");
    return { rapport };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionImportCircuits(_: EtatImport, fd: FormData): Promise<EtatImport> {
  const u = await exigerAdmin();
  const f = fd.get("fichier");
  const campagneId = Number(fd.get("campagneId"));
  if (!campagneId) return { erreur: "Créez d'abord une campagne." };
  if (!(f instanceof File) || !f.size) return { erreur: "Choisissez un fichier." };
  try {
    const rapport = await importerCircuits(await lireTableur(f), campagneId, u.id);
    revalidatePath("/admin", "layout");
    return { rapport };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : String(e) };
  }
}

export async function enregistrerCampagne(fd: FormData) {
  const u = await exigerAdmin();
  const id = Number(fd.get("id") || 0);
  const valeurs = {
    annee: Number(fd.get("annee")),
    titre: String(fd.get("titre") || `Entretiens professionnels ${fd.get("annee")}`),
    dateDebut: String(fd.get("dateDebut") || "") || null,
    dateLimite: String(fd.get("dateLimite") || "") || null,
    objectifsVille: String(fd.get("objectifsVille") ?? ""),
    relanceJours: Math.max(1, Number(fd.get("relanceJours") || 5)),
    statut: String(fd.get("statut") || "ouverte"),
    viseurFinalId: Number(fd.get("viseurFinalId")) || null,
  };
  if (!valeurs.annee) throw new Error("Année obligatoire");
  if (id) await db.update(schema.campagnes).set(valeurs).where(eq(schema.campagnes.id, id));
  else {
    const [c] = await db.insert(schema.campagnes).values(valeurs).returning();
    await journaliser(null, u.id, "Campagne créée", c.titre);
    redirect(`/admin/campagnes/${c.id}`);
  }
  revalidatePath("/admin", "layout");
}

export async function enregistrerObjectifsService(fd: FormData) {
  await exigerAdmin();
  const campagneId = Number(fd.get("campagneId"));
  const niveau = Number(fd.get("niveau"));
  const code = String(fd.get("code"));
  const libelle = String(fd.get("libelle"));
  const texte = String(fd.get("texte") ?? "");
  const [ex] = await db
    .select()
    .from(schema.objectifsServices)
    .where(and(eq(schema.objectifsServices.campagneId, campagneId), eq(schema.objectifsServices.niveau, niveau), eq(schema.objectifsServices.code, code)));
  if (ex) await db.update(schema.objectifsServices).set({ texte, libelle }).where(eq(schema.objectifsServices.id, ex.id));
  else await db.insert(schema.objectifsServices).values({ campagneId, niveau, code, libelle, texte });
  revalidatePath(`/admin/campagnes/${campagneId}`);
}

export async function enregistrerAgent(fd: FormData) {
  await exigerAdmin();
  const id = Number(fd.get("id"));
  const s = (k: string) => (String(fd.get(k) ?? "").trim() || null);
  await db
    .update(schema.agents)
    .set({
      nom: s("nom") ?? "",
      prenom: s("prenom") ?? "",
      email: s("email")?.toLowerCase() ?? null,
      collectivite: s("collectivite") ?? "Ville",
      statut: s("statut"),
      grade: s("grade"),
      poste: s("poste"),
      tempsTravail: s("tempsTravail"),
      actif: fd.get("actif") === "on",
      horsCampagne: fd.get("horsCampagne") === "on",
      isAdmin: fd.get("isAdmin") === "on",
      updatedAt: new Date(),
    })
    .where(eq(schema.agents.id, id));
  revalidatePath(`/admin/agents/${id}`);
}

export async function reinitialiserCode(id: number): Promise<string> {
  const u = await exigerAdmin();
  const code = genererCode();
  await db
    .update(schema.agents)
    .set({ passwordHash: await bcrypt.hash(code, 8), codeProvisoire: code, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(schema.agents.id, id));
  await journaliser(null, u.id, "Code personnel réinitialisé", `Agent #${id}`);
  revalidatePath(`/admin/agents/${id}`);
  return code;
}

/** Remplace le circuit complet (dossier en rédaction) ou crée le dossier. */
export async function enregistrerCircuit(
  campagneId: number,
  agentId: number,
  acteurIds: number[],
  garderCommeException = true,
): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const ids = acteurIds.filter(Boolean);
  if (ids.length < 2) return { ok: false, message: "Le circuit doit comporter au moins l'agent et son N+1." };
  const personnes = await db.select().from(schema.agents).where(inArray(schema.agents.id, [...new Set([...ids, agentId])]));
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const agent = parId.get(agentId)!;
  if (garderCommeException) {
    const sup = ids.filter((i) => i !== agentId).map((i) => parId.get(i)!.matricule);
    await db.update(schema.agents).set({ circuitPersonnalise: sup }).where(eq(schema.agents.id, agentId));
  }
  const res = await creerOuMajDossier(campagneId, agent, ids.map((i) => parId.get(i)!), u.id);
  if (res === "verrouille") return { ok: false, message: "Le dossier est déjà dans le circuit de visas : remplacez les personnes une par une ci-dessous." };
  revalidatePath(`/admin/agents/${agentId}`);
  return { ok: true, message: res === "cree" ? "Dossier créé." : "Circuit mis à jour." };
}

/** Remplace la personne d'une étape non encore visée (ex. N+2 parti en cours de campagne). */
export async function remplacerActeurEtape(etapeId: number, nouvelActeurId: number): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const [et] = await db.select().from(schema.etapes).where(eq(schema.etapes.id, etapeId));
  if (!et) return { ok: false, message: "Étape introuvable." };
  if (et.viseLe) return { ok: false, message: "Cette étape est déjà visée." };
  const [nouveau] = await db.select().from(schema.agents).where(eq(schema.agents.id, nouvelActeurId));
  if (!nouveau) return { ok: false, message: "Personne introuvable." };
  await db.update(schema.etapes).set({ acteurId: nouvelActeurId }).where(eq(schema.etapes.id, etapeId));
  await journaliser(et.entretienId, u.id, "Personne remplacée dans le circuit", `Étape ${et.ordre} → ${nouveau.nom} ${nouveau.prenom}`);
  const [e] = await db.select().from(schema.entretiens).where(eq(schema.entretiens.id, et.entretienId));
  if (e.statut === "circuit" && e.etapeCourante === et.ordre) await notifierTour(e.id);
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Remplacé par ${nouveau.nom} ${nouveau.prenom}.` };
}

/** Change le rédacteur (N+1) d'un dossier en rédaction. */
export async function changerRedacteur(entretienId: number, redacteurId: number): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const [e] = await db.select().from(schema.entretiens).where(eq(schema.entretiens.id, entretienId));
  if (!e || e.statut !== "redaction") return { ok: false, message: "Le rédacteur ne peut être changé que pendant la rédaction." };
  await db.update(schema.entretiens).set({ redacteurId }).where(eq(schema.entretiens.id, entretienId));
  await journaliser(entretienId, u.id, "Rédacteur changé");
  await notifierTour(entretienId);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Rédacteur modifié." };
}

export async function relancerSelection(ids: number[]): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const es = await db
    .select({ id: schema.entretiens.id })
    .from(schema.entretiens)
    .where(and(inArray(schema.entretiens.id, ids), ne(schema.entretiens.statut, "termine")));
  for (const e of es) {
    await notifierTour(e.id, "relance");
    await db.update(schema.entretiens).set({ derniereRelanceLe: new Date() }).where(eq(schema.entretiens.id, e.id));
    await journaliser(e.id, u.id, "Relance groupée");
  }
  return { ok: true, message: `${es.length} relance(s) traitée(s). Voir « E-mails » pour le détail (les personnes sans adresse ne reçoivent rien).` };
}

/** Calcule (simulation) ou crée les dossiers de la campagne à partir de l'organigramme / des exceptions / de l'an dernier. */
export async function actionGenererDossiers(campagneId: number, reconduire: boolean, simulation: boolean): Promise<LigneCircuit[]> {
  const u = await exigerAdmin();
  const lignes = await genererDossiers(campagneId, { reconduire }, simulation, u.id);
  if (!simulation) revalidatePath("/admin", "layout");
  return lignes;
}

/** Revenir au circuit automatique (supprime l'exception). */
export async function supprimerException(agentId: number) {
  await exigerAdmin();
  await db.update(schema.agents).set({ circuitPersonnalise: null }).where(eq(schema.agents.id, agentId));
  revalidatePath(`/admin/agents/${agentId}`);
}

/** Retire un dossier de la campagne (agent non concerné), uniquement s'il n'a pas encore été visé. */
export async function retirerDossier(entretienId: number): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const [e] = await db.select().from(schema.entretiens).where(eq(schema.entretiens.id, entretienId));
  if (!e) return { ok: false, message: "Dossier introuvable." };
  if (e.statut !== "redaction") return { ok: false, message: "Un dossier déjà visé ne peut pas être retiré." };
  await supprimerEntretien(entretienId);
  await journaliser(null, u.id, "Dossier retiré de la campagne", `Agent #${e.agentId}`);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Dossier retiré de la campagne." };
}

/**
 * Remplace une personne partout : étapes non encore visées des dossiers en cours, rédaction (N+1),
 * circuits d'exception et « dernier visa » des campagnes ouvertes.
 */
export async function remplacerPartout(ancienId: number, nouveauId: number): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  if (!ancienId || !nouveauId || ancienId === nouveauId) return { ok: false, message: "Choisissez deux personnes différentes." };
  const [ancien] = await db.select().from(schema.agents).where(eq(schema.agents.id, ancienId));
  const [nouveau] = await db.select().from(schema.agents).where(eq(schema.agents.id, nouveauId));
  if (!ancien || !nouveau) return { ok: false, message: "Personne introuvable." };
  const ouvertes = await db.select({ id: schema.campagnes.id }).from(schema.campagnes).where(eq(schema.campagnes.statut, "ouverte"));
  const idsCamp = ouvertes.map((c) => c.id);
  let etapesMaj = 0;
  let redac = 0;
  const aNotifier = new Set<number>();
  if (idsCamp.length) {
    const dossiers = await db
      .select()
      .from(schema.entretiens)
      .where(and(inArray(schema.entretiens.campagneId, idsCamp), ne(schema.entretiens.statut, "termine")));
    for (const d of dossiers) {
      if (d.agentId === ancienId) continue; // on ne remplace jamais l'agent évalué lui-même
      const ets = await db.select().from(schema.etapes).where(eq(schema.etapes.entretienId, d.id));
      for (const et of ets) {
        if (et.acteurId === ancienId && !et.viseLe) {
          await db.update(schema.etapes).set({ acteurId: nouveauId }).where(eq(schema.etapes.id, et.id));
          etapesMaj++;
          if (d.statut === "circuit" && d.etapeCourante === et.ordre) aNotifier.add(d.id);
        }
      }
      if (d.statut === "redaction" && d.redacteurId === ancienId) {
        await db.update(schema.entretiens).set({ redacteurId: nouveauId }).where(eq(schema.entretiens.id, d.id));
        redac++;
        aNotifier.add(d.id);
      }
      if (ets.some((et) => et.acteurId === ancienId && !et.viseLe) || d.redacteurId === ancienId)
        await journaliser(d.id, u.id, "Remplacement de personne", `${ancien.nom} ${ancien.prenom} → ${nouveau.nom} ${nouveau.prenom}`);
    }
    await db
      .update(schema.campagnes)
      .set({ viseurFinalId: nouveauId })
      .where(and(inArray(schema.campagnes.id, idsCamp), eq(schema.campagnes.viseurFinalId, ancienId)));
  }
  let exceptions = 0;
  for (const a of await db.select().from(schema.agents)) {
    if (a.circuitPersonnalise?.includes(ancien.matricule)) {
      await db
        .update(schema.agents)
        .set({ circuitPersonnalise: a.circuitPersonnalise.map((m) => (m === ancien.matricule ? nouveau.matricule : m)) })
        .where(eq(schema.agents.id, a.id));
      exceptions++;
    }
  }
  for (const id of aNotifier) await notifierTour(id);
  await journaliser(null, u.id, "Remplacement en masse", `${ancien.nom} → ${nouveau.nom} : ${etapesMaj} visas, ${redac} rédactions, ${exceptions} exceptions`);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `${ancien.nom} ${ancien.prenom} remplacé(e) par ${nouveau.nom} ${nouveau.prenom} : ${etapesMaj} visa(s) à venir, ${redac} rédaction(s), ${exceptions} circuit(s) d'exception.`,
  };
}

/** Enregistre en une fois les visas papier reçus (agents sans accès informatique). */
export async function visasPapierEnLot(entretienIds: number[], dateIso: string): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : new Date();
  let n = 0;
  for (const id of entretienIds) {
    const [e] = await db.select().from(schema.entretiens).where(eq(schema.entretiens.id, id));
    if (!e || e.statut !== "circuit") continue;
    const [et] = await db.select().from(schema.etapes).where(and(eq(schema.etapes.entretienId, id), eq(schema.etapes.ordre, e.etapeCourante)));
    if (!et || et.acteurId !== e.agentId || et.viseLe) continue;
    await db.update(schema.etapes).set({ viseLe: date, modeVisa: "papier", enregistreParId: u.id }).where(eq(schema.etapes.id, et.id));
    await journaliser(id, u.id, "Visa papier enregistré par les RH (lot)", `Daté du ${date.toLocaleDateString("fr-FR")}`);
    await avancer(id, et.ordre);
    n++;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${n} visa(s) papier enregistré(s).` };
}

export type EtatAgent = { erreur?: string } | undefined;

/** Ajoute un agent à la main (arrivée entre deux exports Inser / Ciril). */
export async function creerAgent(_: EtatAgent, fd: FormData): Promise<EtatAgent> {
  const u = await exigerAdmin();
  const s = (k: string) => String(fd.get(k) ?? "").trim() || null;
  const matricule = s("matricule");
  const nom = s("nom");
  if (!matricule || !nom) return { erreur: "Le matricule et le nom sont obligatoires." };
  const [existe] = await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.matricule, matricule));
  if (existe) return { erreur: `Le matricule ${matricule} existe déjà.` };
  const [n3, l3, n4, l4] = (s("service") ?? "|||").split("|");
  const responsableId = Number(fd.get("responsableId")) || null;
  const [resp] = responsableId ? await db.select().from(schema.agents).where(eq(schema.agents.id, responsableId)) : [];
  const code = genererCode();
  const [a] = await db
    .insert(schema.agents)
    .values({
      matricule,
      nom: nom.toUpperCase(),
      prenom: s("prenom") ?? "",
      email: s("email")?.toLowerCase() ?? null,
      statut: s("statut"),
      categorie: s("categorie"),
      grade: s("grade"),
      poste: s("poste"),
      tempsTravail: s("tempsTravail") ?? "Temps Plein",
      collectivite: s("collectivite") ?? "Ville",
      niv3Code: n3 || null,
      niv3: l3 || null,
      niv4Code: n4 || null,
      niv4: l4 || null,
      responsables: resp ? { "6": { email: resp.email, nom: `${resp.nom} ${resp.prenom}` } } : null,
      passwordHash: await bcrypt.hash(code, 8),
      codeProvisoire: code,
      mustChangePassword: true,
    })
    .returning();
  await journaliser(null, u.id, "Agent ajouté à la main", `${a.nom} ${a.prenom} (${a.matricule})`);
  // Dossier de la campagne en cours, si demandé
  const campagneId = Number(fd.get("campagneId")) || null;
  if (campagneId && fd.get("creerDossier") === "on") {
    const tous = await db.select().from(schema.agents);
    const { indexAgents, calculerCircuit } = await import("@/lib/circuits");
    const idx = indexAgents(tous);
    const [camp] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, campagneId));
    const viseur = camp.viseurFinalId ? idx.parId.get(camp.viseurFinalId) ?? null : null;
    const c = await calculerCircuit(a, idx, { viseurFinal: viseur, reconduire: false, annee: camp.annee });
    if (c.sup.length) await creerOuMajDossier(campagneId, a, [a, ...c.sup, a], u.id);
  }
  revalidatePath("/admin/agents");
  redirect(`/admin/agents/${a.id}?cree=1`);
}

/**
 * Supprime un agent.
 * - S'il doit encore viser ou rédiger pour d'autres agents : refus (le remplacer d'abord).
 * - Ses propres dossiers pas encore visés sont supprimés.
 * - S'il reste des comptes rendus visés (les siens, ou des visas déjà donnés) : il est ARCHIVÉ
 *   (désactivé, hors campagne) pour conserver les documents.
 * - Sinon : suppression définitive.
 */
export async function supprimerAgent(id: number): Promise<{ ok: boolean; message: string; archive?: boolean }> {
  const u = await exigerAdmin();
  if (id === u.id) return { ok: false, message: "Vous ne pouvez pas supprimer votre propre compte." };
  const [a] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
  if (!a) return { ok: false, message: "Agent introuvable." };

  const enAttente = await db
    .select({ id: schema.etapes.id })
    .from(schema.etapes)
    .innerJoin(schema.entretiens, eq(schema.entretiens.id, schema.etapes.entretienId))
    .where(and(eq(schema.etapes.acteurId, id), ne(schema.entretiens.agentId, id), ne(schema.entretiens.statut, "termine"), isNull(schema.etapes.viseLe)));
  const redige = await db
    .select({ id: schema.entretiens.id })
    .from(schema.entretiens)
    .where(and(eq(schema.entretiens.redacteurId, id), ne(schema.entretiens.agentId, id), eq(schema.entretiens.statut, "redaction")));
  const viseur = await db.select({ id: schema.campagnes.id }).from(schema.campagnes).where(and(eq(schema.campagnes.viseurFinalId, id), eq(schema.campagnes.statut, "ouverte")));
  if (enAttente.length || redige.length || viseur.length)
    return {
      ok: false,
      message: `${a.nom} ${a.prenom} doit encore intervenir sur ${enAttente.length + redige.length} dossier(s) d'autres agents${viseur.length ? " et est le dernier visa d'une campagne" : ""}. Utilisez d'abord « Remplacer une personne », puis supprimez-le.`,
    };

  // Ses dossiers non encore visés (brouillons) disparaissent
  const siens = await db.select().from(schema.entretiens).where(eq(schema.entretiens.agentId, id));
  for (const e of siens.filter((x) => x.statut === "redaction")) await supprimerEntretien(e.id);
  const garde = siens.filter((x) => x.statut !== "redaction").length;
  const enCoursDeVisa = siens.filter((x) => x.statut === "circuit").length;
  const [visesAilleurs] = await db.select({ id: schema.etapes.id }).from(schema.etapes).where(eq(schema.etapes.acteurId, id)).limit(1);
  const [redacteurAilleurs] = await db.select({ id: schema.entretiens.id }).from(schema.entretiens).where(eq(schema.entretiens.redacteurId, id)).limit(1);
  const [enregistre] = await db.select({ id: schema.etapes.id }).from(schema.etapes).where(eq(schema.etapes.enregistreParId, id)).limit(1);

  if (garde || visesAilleurs || redacteurAilleurs || enregistre) {
    await db
      .update(schema.agents)
      .set({ actif: false, horsCampagne: true, isAdmin: false, codeProvisoire: null, circuitPersonnalise: null, updatedAt: new Date() })
      .where(eq(schema.agents.id, id));
    await journaliser(null, u.id, "Agent archivé", `${a.nom} ${a.prenom} (${a.matricule})`);
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      archive: true,
      message: `${a.nom} ${a.prenom} a été archivé(e) : il/elle ne peut plus se connecter et n'apparaîtra plus dans les campagnes. Ses comptes rendus et visas déjà donnés sont conservés.${enCoursDeVisa ? ` Attention : ${enCoursDeVisa} de ses comptes rendus est en cours de visa ; enregistrez son visa papier ou retirez le dossier.` : ""}`,
    };
  }
  await db.update(schema.historique).set({ acteurId: null }).where(eq(schema.historique.acteurId, id));
  await db.delete(schema.agents).where(eq(schema.agents.id, id));
  await journaliser(null, u.id, "Agent supprimé", `${a.nom} ${a.prenom} (${a.matricule})`);
  // la fiche n'existe plus : retour à la liste, avec le message
  redirect(`/admin/agents?supprime=${encodeURIComponent(`${a.nom} ${a.prenom}`)}`);
}

/** Suppression complète d'un dossier et de tout ce qui s'y rattache. */
async function supprimerEntretien(id: number) {
  await db.delete(schema.etapes).where(eq(schema.etapes.entretienId, id));
  await db.delete(schema.historique).where(eq(schema.historique.entretienId, id));
  await db.delete(schema.recours).where(eq(schema.recours.entretienId, id));
  await db.delete(schema.pdfsDefinitifs).where(eq(schema.pdfsDefinitifs.entretienId, id));
  await db.delete(schema.entretiens).where(eq(schema.entretiens.id, id));
}

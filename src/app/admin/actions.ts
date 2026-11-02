"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { exigerAdmin, genererCode } from "@/lib/auth";
import { lireTableur } from "@/lib/tableur";
import { creerOuMajDossier, importerAgents, importerCircuits, type Rapport } from "@/lib/imports";
import { journaliser, notifierTour } from "@/lib/workflow";

export type EtatImport = { rapport?: Rapport; erreur?: string } | undefined;

export async function actionImportAgents(_: EtatImport, fd: FormData): Promise<EtatImport> {
  const u = await exigerAdmin();
  const f = fd.get("fichier");
  if (!(f instanceof File) || !f.size) return { erreur: "Choisissez un fichier." };
  try {
    const rapport = await importerAgents(await lireTableur(f), u.id);
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
export async function enregistrerCircuit(campagneId: number, agentId: number, acteurIds: number[]): Promise<{ ok: boolean; message: string }> {
  const u = await exigerAdmin();
  const ids = acteurIds.filter(Boolean);
  if (ids.length < 2) return { ok: false, message: "Le circuit doit comporter au moins l'agent et son N+1." };
  const personnes = await db.select().from(schema.agents).where(inArray(schema.agents.id, [...new Set([...ids, agentId])]));
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const agent = parId.get(agentId)!;
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

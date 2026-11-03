"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { createHash, randomBytes } from "crypto";
import { fermerSession, ouvrirSession, exigerUtilisateur } from "@/lib/auth";
import { envoyerEmail, urlApp } from "@/lib/emails";

export type EtatForm = { erreur?: string; info?: string } | undefined;

const MAX_ESSAIS = 5;
const BLOCAGE_MIN = 15;
const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

/** « Mot de passe oublié » : lien de réinitialisation par e-mail (valable 1 heure). Réponse identique dans tous les cas. */
export async function demanderReinitialisation(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const saisie = String(fd.get("identifiant") ?? "").trim();
  const neutre = {
    info: "Si un e-mail est associé à ce compte, un lien pour choisir un nouveau mot de passe vient d'y être envoyé (valable 1 heure). Vous n'avez pas d'adresse e-mail ? Demandez un nouveau code à votre responsable ou au service RH.",
  };
  if (!saisie) return { erreur: "Indiquez votre matricule ou votre adresse e-mail." };
  const [u] = await db
    .select()
    .from(schema.agents)
    .where(saisie.includes("@") ? eq(schema.agents.email, saisie.toLowerCase()) : eq(schema.agents.matricule, saisie));
  if (!u || !u.actif || !u.email) return neutre;
  const jeton = randomBytes(32).toString("hex");
  await db.update(schema.agents).set({ resetJeton: empreinte(jeton), resetExpire: new Date(Date.now() + 3_600_000) }).where(eq(schema.agents.id, u.id));
  await envoyerEmail({
    to: u.email,
    type: "autre",
    sujet: "Entretiens professionnels : choisir un nouveau mot de passe",
    corps: `Bonjour ${u.prenom},

Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :
${urlApp()}/reinitialiser?jeton=${jeton}

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.

Le service des Ressources Humaines`,
  });
  return neutre;
}

export async function reinitialiserMotDePasse(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const jeton = String(fd.get("jeton") ?? "");
  const nouveau = String(fd.get("nouveau") ?? "");
  if (nouveau.length < 8) return { erreur: "Le mot de passe doit contenir au moins 8 caractères." };
  if (nouveau !== String(fd.get("confirmation") ?? "")) return { erreur: "Les deux saisies ne correspondent pas." };
  const [u] = jeton ? await db.select().from(schema.agents).where(eq(schema.agents.resetJeton, empreinte(jeton))) : [];
  if (!u || !u.resetExpire || u.resetExpire.getTime() < Date.now()) return { erreur: "Ce lien n'est plus valable. Refaites une demande depuis « Mot de passe oublié »." };
  await db
    .update(schema.agents)
    .set({ passwordHash: await bcrypt.hash(nouveau, 10), mustChangePassword: false, codeProvisoire: null, resetJeton: null, resetExpire: null, tentativesEchouees: 0, bloqueJusqua: null })
    .where(eq(schema.agents.id, u.id));
  await ouvrirSession(u.id);
  redirect("/");
}

export async function connexion(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const matricule = String(fd.get("matricule") ?? "").trim();
  const mdp = String(fd.get("motdepasse") ?? "");
  if (!matricule || !mdp) return { erreur: "Matricule et code personnel obligatoires." };
  await amorcerAdministrateur(matricule, mdp);
  const [u] = await db.select().from(schema.agents).where(eq(schema.agents.matricule, matricule));
  if (u?.bloqueJusqua && u.bloqueJusqua.getTime() > Date.now()) {
    const min = Math.ceil((u.bloqueJusqua.getTime() - Date.now()) / 60_000);
    return { erreur: `Trop d'essais incorrects : compte bloqué encore ${min} minute(s). En cas d'oubli, demandez un nouveau code à votre responsable ou aux RH.` };
  }
  if (!u || !u.actif || !u.passwordHash || !(await bcrypt.compare(mdp, u.passwordHash))) {
    if (u) {
      const n = u.tentativesEchouees + 1;
      await db
        .update(schema.agents)
        .set(n >= MAX_ESSAIS ? { tentativesEchouees: 0, bloqueJusqua: new Date(Date.now() + BLOCAGE_MIN * 60_000) } : { tentativesEchouees: n })
        .where(eq(schema.agents.id, u.id));
      if (n >= MAX_ESSAIS) return { erreur: `Trop d'essais incorrects : compte bloqué pendant ${BLOCAGE_MIN} minutes.` };
    }
    return { erreur: "Matricule ou code personnel incorrect." };
  }
  await db.update(schema.agents).set({ derniereConnexion: new Date(), tentativesEchouees: 0, bloqueJusqua: null }).where(eq(schema.agents.id, u.id));
  await ouvrirSession(u.id);
  redirect(u.mustChangePassword ? "/mot-de-passe" : "/");
}

/**
 * Premier démarrage : tant qu'aucun administrateur RH n'existe, se connecter avec
 * ADMIN_MATRICULE / ADMIN_PASSWORD (variables d'environnement) crée le compte RH.
 * Dès qu'un administrateur existe, ces variables n'ont plus aucun effet.
 */
async function amorcerAdministrateur(matricule: string, mdp: string) {
  const attendu = process.env.ADMIN_MATRICULE;
  const secret = process.env.ADMIN_PASSWORD;
  if (!attendu || !secret || secret.length < 8 || matricule !== attendu || mdp !== secret) return;
  const [dejaAdmin] = await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.isAdmin, true)).limit(1);
  if (dejaAdmin) return;
  const hash = await bcrypt.hash(mdp, 10);
  const [ex] = await db.select().from(schema.agents).where(eq(schema.agents.matricule, matricule));
  if (ex) await db.update(schema.agents).set({ isAdmin: true, actif: true, passwordHash: hash, mustChangePassword: true }).where(eq(schema.agents.id, ex.id));
  else await db.insert(schema.agents).values({ matricule, nom: "Administrateur", prenom: "RH", isAdmin: true, passwordHash: hash, mustChangePassword: true });
}

export async function deconnexion() {
  await fermerSession();
  redirect("/connexion");
}

export async function changerMotDePasse(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const u = await exigerUtilisateur({ autoriserMdpProvisoire: true });
  const actuel = String(fd.get("actuel") ?? "");
  const nouveau = String(fd.get("nouveau") ?? "");
  const confirmation = String(fd.get("confirmation") ?? "");
  if (!u.passwordHash || !(await bcrypt.compare(actuel, u.passwordHash))) return { erreur: "Le code actuel est incorrect." };
  if (nouveau.length < 8) return { erreur: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  if (nouveau !== confirmation) return { erreur: "Les deux saisies ne correspondent pas." };
  if (nouveau === actuel) return { erreur: "Choisissez un mot de passe différent du code provisoire." };
  await db
    .update(schema.agents)
    .set({ passwordHash: await bcrypt.hash(nouveau, 10), mustChangePassword: false, codeProvisoire: null, updatedAt: new Date() })
    .where(eq(schema.agents.id, u.id));
  redirect("/");
}

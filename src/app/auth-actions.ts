"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { fermerSession, ouvrirSession, exigerUtilisateur } from "@/lib/auth";

export type EtatForm = { erreur?: string } | undefined;

export async function connexion(_: EtatForm, fd: FormData): Promise<EtatForm> {
  const matricule = String(fd.get("matricule") ?? "").trim();
  const mdp = String(fd.get("motdepasse") ?? "");
  if (!matricule || !mdp) return { erreur: "Matricule et code personnel obligatoires." };
  await amorcerAdministrateur(matricule, mdp);
  const [u] = await db.select().from(schema.agents).where(eq(schema.agents.matricule, matricule));
  if (!u || !u.actif || !u.passwordHash || !(await bcrypt.compare(mdp, u.passwordHash)))
    return { erreur: "Matricule ou code personnel incorrect." };
  await db.update(schema.agents).set({ derniereConnexion: new Date() }).where(eq(schema.agents.id, u.id));
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

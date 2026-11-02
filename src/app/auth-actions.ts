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
  const [u] = await db.select().from(schema.agents).where(eq(schema.agents.matricule, matricule));
  if (!u || !u.actif || !u.passwordHash || !(await bcrypt.compare(mdp, u.passwordHash)))
    return { erreur: "Matricule ou code personnel incorrect." };
  await db.update(schema.agents).set({ derniereConnexion: new Date() }).where(eq(schema.agents.id, u.id));
  await ouvrirSession(u.id);
  redirect(u.mustChangePassword ? "/mot-de-passe" : "/");
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

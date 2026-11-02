import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

const COOKIE = "ep_session";
const DUREE_S = 60 * 60 * 10; // 10 h

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum).");
  return new TextEncoder().encode(s);
}

export async function ouvrirSession(agentId: number) {
  const token = await new SignJWT({ sub: String(agentId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_S,
  });
}

export async function fermerSession() {
  (await cookies()).delete(COOKIE);
}

export async function utilisateurCourant() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    const [u] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
    if (!u || !u.actif) return null;
    return u;
  } catch {
    return null;
  }
}

export async function exigerUtilisateur(opts: { autoriserMdpProvisoire?: boolean } = {}) {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (u.mustChangePassword && !opts.autoriserMdpProvisoire) redirect("/mot-de-passe");
  return u;
}

export async function exigerAdmin() {
  const u = await exigerUtilisateur();
  if (!u.isAdmin) redirect("/");
  return u;
}

/** Génère un code provisoire lisible (sans caractères ambigus). */
export function genererCode(longueur = 8) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(longueur));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

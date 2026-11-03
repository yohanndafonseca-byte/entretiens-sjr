import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { genererCode } from "./auth";
import { indexAgents, circuitOrganigramme } from "./circuits";
import { envoyerEmail, urlApp } from "./emails";
import { genererFichesCodes } from "./pdf";
import { journaliser } from "./workflow";

/** Agent « sans outil informatique » : forcé par les RH, ou automatiquement s'il n'a pas d'e-mail. */
export const estSansOutil = (a: Pick<Agent, "profilAcces" | "email">) => a.profilAcces === "sans_outil" || (a.profilAcces === "auto" && !a.email);

export const LIBELLE_PROFIL: Record<string, string> = {
  auto: "Automatique (selon l'e-mail)",
  connecte: "Connecté (a un e-mail et l'utilise)",
  sans_outil: "Sans outil informatique (code renouvelé chaque campagne)",
};

/** Responsable direct : rédacteur de son dossier dans une campagne ouverte, sinon d'après l'organigramme. */
async function responsablesDirects(agents: Agent[]) {
  const ouvertes = await db.select({ id: schema.campagnes.id }).from(schema.campagnes).where(eq(schema.campagnes.statut, "ouverte"));
  const dossiers = ouvertes.length
    ? await db
        .select({ agentId: schema.entretiens.agentId, redacteurId: schema.entretiens.redacteurId })
        .from(schema.entretiens)
        .where(inArray(schema.entretiens.campagneId, ouvertes.map((c) => c.id)))
    : [];
  const tous = await db.select().from(schema.agents);
  const idx = indexAgents(tous);
  const res = new Map<number, Agent | null>();
  for (const a of agents) {
    const r = dossiers.find((d) => d.agentId === a.id && d.redacteurId)?.redacteurId;
    res.set(a.id, (r && idx.parId.get(r)) || circuitOrganigramme(a, idx, null).sup[0] || null);
  }
  return res;
}

export async function agentsSansOutil() {
  const tous = await db.select().from(schema.agents).where(and(eq(schema.agents.actif, true), eq(schema.agents.horsCampagne, false)));
  return tous.filter(estSansOutil);
}

/**
 * Nouvelle campagne : un nouveau code pour chaque agent sans outil informatique.
 * Les anciens codes / mots de passe cessent immédiatement de fonctionner.
 * Option : chaque responsable direct reçoit par e-mail un PDF avec les fiches de code de son équipe.
 */
export async function regenererCodesSansOutil(parId: number, opts: { envoyerAuxResponsables: boolean; direction?: string | null }) {
  const cibles = (await agentsSansOutil()).filter((a) => !opts.direction || a.niv3 === opts.direction);
  const nouveaux: (Agent & { codeProvisoire: string })[] = [];
  for (const a of cibles) {
    const code = genererCode();
    await db
      .update(schema.agents)
      .set({ passwordHash: await bcrypt.hash(code, 8), codeProvisoire: code, mustChangePassword: true, codeGenereLe: new Date(), tentativesEchouees: 0, bloqueJusqua: null, updatedAt: new Date() })
      .where(eq(schema.agents.id, a.id));
    nouveaux.push({ ...a, codeProvisoire: code });
  }
  let envoyes = 0;
  const sansResponsable: string[] = [];
  if (opts.envoyerAuxResponsables && nouveaux.length) {
    const resp = await responsablesDirects(nouveaux);
    const parResp = new Map<number, typeof nouveaux>();
    for (const a of nouveaux) {
      const r = resp.get(a.id);
      if (!r?.email) {
        sansResponsable.push(`${a.nom} ${a.prenom}${r ? ` (responsable ${r.nom} ${r.prenom} sans e-mail)` : ""}`);
        continue;
      }
      parResp.set(r.id, [...(parResp.get(r.id) ?? []), a]);
    }
    const responsables = await db.select().from(schema.agents).where(inArray(schema.agents.id, [...parResp.keys(), -1]));
    for (const r of responsables) {
      const equipe = parResp.get(r.id)!;
      const pdf = await genererFichesCodes(equipe);
      await envoyerEmail({
        to: r.email,
        type: "autre",
        sujet: `Codes personnels de votre équipe pour les entretiens professionnels (${equipe.length} agent(s))`,
        corps: `Bonjour,\n\nVous trouverez ci-joint les fiches de code personnel des agents de votre équipe qui n'ont pas d'outil informatique :\n${equipe.map((a) => `- ${a.nom} ${a.prenom}`).join("\n")}\n\nMerci d'imprimer ces fiches, de les découper et de remettre à chaque agent la sienne, en main propre. Ce code lui permettra de viser son compte rendu (sur votre poste, ou sur ${urlApp()}).\n\nCes codes sont personnels : merci de ne pas les conserver ni les utiliser vous-même. Chaque visa est tracé.\n\nLe service des Ressources Humaines`,
        pieceJointe: { nom: "Fiches codes personnels.pdf", contenu: pdf, type: "application/pdf" },
      });
      envoyes++;
    }
  }
  await journaliser(null, parId, "Codes de campagne régénérés", `${nouveaux.length} agent(s) sans outil informatique${opts.envoyerAuxResponsables ? `, fiches envoyées à ${envoyes} responsable(s)` : ""}`);
  return { regeneres: nouveaux.length, responsablesPrevenus: envoyes, sansResponsable };
}

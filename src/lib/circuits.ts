import "server-only";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { creerOuMajDossier } from "./imports";
import { journaliser } from "./workflow";

/**
 * Calcul automatique des circuits de visa.
 *
 * Ordre de priorité pour chaque agent :
 *   1. le circuit d'EXCEPTION fixé par les RH sur la fiche de l'agent (gardé d'une année sur l'autre) ;
 *   2. (option) le circuit de la campagne précédente, si toutes les personnes sont toujours en poste ;
 *   3. le circuit calculé depuis l'organigramme de l'export (responsables des niveaux 6 → 3),
 *      complété par le « dernier visa » de la campagne (autorité territoriale / DGS).
 * Le circuit commence et se termine toujours par l'agent.
 */

export type Source = "exception" | "reconduit" | "organigramme";
export type LigneCircuit = {
  agentId: number;
  agent: string;
  service: string;
  circuit: string[];
  source: Source | null;
  resultat: "cree" | "maj" | "inchange" | "verrouille" | "ignore";
  alertes: string[];
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export function indexAgents(agents: Agent[]) {
  const parEmail = new Map<string, Agent>();
  const parNom = new Map<string, Agent | null>();
  const parMatricule = new Map<string, Agent>();
  for (const a of agents) {
    parMatricule.set(a.matricule, a);
    if (a.email) parEmail.set(a.email.toLowerCase(), a);
    for (const k of [norm(`${a.nom} ${a.prenom}`), norm(`${a.prenom} ${a.nom}`)]) {
      // un homonyme rend le nom ambigu : on ne s'en sert pas
      parNom.set(k, parNom.has(k) && parNom.get(k)?.id !== a.id ? null : a);
    }
  }
  return {
    parMatricule,
    parId: new Map(agents.map((a) => [a.id, a])),
    trouver(r: { email: string | null; nom: string | null } | undefined): Agent | null {
      if (!r) return null;
      if (r.email && parEmail.has(r.email.toLowerCase())) return parEmail.get(r.email.toLowerCase())!;
      if (r.nom) return parNom.get(norm(r.nom)) ?? null;
      return null;
    },
  };
}
type Index = ReturnType<typeof indexAgents>;

export function circuitOrganigramme(agent: Agent, idx: Index, viseurFinal: Agent | null) {
  const alertes: string[] = [];
  const sup: Agent[] = [];
  for (const n of ["6", "5", "4", "3"] as const) {
    const r = agent.responsables?.[n];
    if (!r) continue;
    const p = idx.trouver(r);
    if (!p) {
      alertes.push(`Responsable niveau ${n} « ${r.nom ?? r.email} » introuvable dans la base agents.`);
      continue;
    }
    if (!p.actif) alertes.push(`Responsable niveau ${n} ${p.nom} ${p.prenom} est inactif (parti ?).`);
    if (p.id !== agent.id && !sup.some((x) => x.id === p.id)) sup.push(p);
  }
  if (viseurFinal && viseurFinal.id !== agent.id && !sup.some((x) => x.id === viseurFinal.id)) sup.push(viseurFinal);
  return { sup, alertes };
}

async function circuitPrecedent(agentId: number, annee: number) {
  const [prec] = await db
    .select({ id: schema.entretiens.id })
    .from(schema.entretiens)
    .innerJoin(schema.campagnes, eq(schema.campagnes.id, schema.entretiens.campagneId))
    .where(and(eq(schema.entretiens.agentId, agentId), lt(schema.campagnes.annee, annee)))
    .orderBy(desc(schema.campagnes.annee))
    .limit(1);
  if (!prec) return null;
  const ets = await db.select().from(schema.etapes).where(eq(schema.etapes.entretienId, prec.id)).orderBy(asc(schema.etapes.ordre));
  return ets.map((e) => e.acteurId);
}

export async function calculerCircuit(agent: Agent, idx: Index, opts: { viseurFinal: Agent | null; reconduire: boolean; annee: number }) {
  const alertes: string[] = [];
  // 1. Exception RH
  if (agent.circuitPersonnalise?.length) {
    const sup = agent.circuitPersonnalise.map((m) => idx.parMatricule.get(m)).filter(Boolean) as Agent[];
    const inactifs = sup.filter((p) => !p.actif);
    if (sup.length === agent.circuitPersonnalise.length && !inactifs.length) return { sup, source: "exception" as Source, alertes };
    alertes.push(
      `Circuit d'exception inutilisable (${inactifs.map((p) => `${p.nom} ${p.prenom} inactif`).join(", ") || "personne introuvable"}) : calcul automatique utilisé, à vérifier.`,
    );
  }
  // 2. Reconduction de l'an dernier
  if (opts.reconduire) {
    const prec = await circuitPrecedent(agent.id, opts.annee);
    if (prec) {
      const sup = prec.filter((id) => id !== agent.id).map((id) => idx.parId.get(id)).filter(Boolean) as Agent[];
      const inactifs = sup.filter((p) => !p.actif);
      if (sup.length && !inactifs.length) return { sup, source: "reconduit" as Source, alertes };
      if (inactifs.length) alertes.push(`Circuit de l'an dernier non reconduit : ${inactifs.map((p) => `${p.nom} ${p.prenom}`).join(", ")} n'est plus en poste.`);
    }
  }
  // 3. Organigramme
  const o = circuitOrganigramme(agent, idx, opts.viseurFinal);
  return { sup: o.sup, source: "organigramme" as Source, alertes: [...alertes, ...o.alertes] };
}

/** Génère (ou simule) les dossiers de tous les agents actifs pour une campagne. */
export async function genererDossiers(campagneId: number, opts: { reconduire: boolean }, simulation: boolean, parId: number) {
  const [camp] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, campagneId));
  const agents = await db.select().from(schema.agents);
  const idx = indexAgents(agents);
  const viseurFinal = camp.viseurFinalId ? idx.parId.get(camp.viseurFinalId) ?? null : null;
  const existants = await db.select().from(schema.entretiens).where(eq(schema.entretiens.campagneId, campagneId));
  const etapesEx = new Map<number, number[]>();
  for (const e of existants) {
    const ets = await db.select({ a: schema.etapes.acteurId }).from(schema.etapes).where(eq(schema.etapes.entretienId, e.id)).orderBy(asc(schema.etapes.ordre));
    etapesEx.set(e.agentId, ets.map((x) => x.a));
  }
  const parAgent = new Map(existants.map((e) => [e.agentId, e]));
  const lignes: LigneCircuit[] = [];

  for (const a of agents.filter((x) => x.actif).sort((x, y) => x.nom.localeCompare(y.nom))) {
    const base = { agentId: a.id, agent: `${a.nom} ${a.prenom}`, service: a.niv4 ?? a.niv3 ?? "" };
    if (a.horsCampagne) {
      lignes.push({ ...base, circuit: [], source: null, resultat: "ignore", alertes: ["Marqué « non concerné par les entretiens »."] });
      continue;
    }
    const ex = parAgent.get(a.id);
    if (ex && ex.statut !== "redaction") {
      const ids = etapesEx.get(a.id) ?? [];
      lignes.push({ ...base, circuit: ids.map((id) => nomDe(idx.parId.get(id))), source: null, resultat: "verrouille", alertes: [] });
      continue;
    }
    const c = await calculerCircuit(a, idx, { viseurFinal, reconduire: opts.reconduire, annee: camp.annee });
    if (!c.sup.length) {
      const estViseurFinal = viseurFinal?.id === a.id;
      lignes.push({
        ...base,
        circuit: [],
        source: c.source,
        resultat: "ignore",
        alertes: [
          ...c.alertes,
          estViseurFinal
            ? "Dernier visa de la campagne : son entretien relève de l'autorité territoriale. Créez son circuit à la main si besoin, ou cochez « non concerné »."
            : "Aucun supérieur trouvé : définir le circuit à la main sur la fiche de l'agent.",
        ],
      });
      continue;
    }
    const acteurs = [a, ...c.sup, a];
    const ids = acteurs.map((x) => x.id);
    const identique = ex && JSON.stringify(etapesEx.get(a.id)) === JSON.stringify(ids);
    let resultat: LigneCircuit["resultat"] = ex ? (identique ? "inchange" : "maj") : "cree";
    if (!simulation && resultat !== "inchange") {
      const r = await creerOuMajDossier(campagneId, a, acteurs, parId);
      if (r === "verrouille") resultat = "verrouille";
    }
    lignes.push({ ...base, circuit: c.sup.map(nomDe), source: c.source, resultat, alertes: c.alertes });
  }
  if (!simulation) {
    const n = lignes.filter((l) => l.resultat === "cree").length;
    await journaliser(null, parId, "Génération automatique des dossiers", `${n} créés, ${lignes.filter((l) => l.resultat === "maj").length} circuits mis à jour`);
  }
  return lignes;
}

const nomDe = (a: Agent | undefined | null) => (a ? `${a.nom} ${a.prenom}`.trim() : "?");

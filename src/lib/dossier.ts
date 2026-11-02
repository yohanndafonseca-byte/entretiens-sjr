import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { normaliserContenu } from "./formulaire";

export type EtapeDetail = schema.Etape & { acteur: Agent; estAgent: boolean };

export type Dossier = Awaited<ReturnType<typeof chargerDossier>>;

/** Charge un entretien avec tout ce qu'il faut pour l'afficher / le générer en PDF. */
export async function chargerDossier(id: number) {
  const [e] = await db.select().from(schema.entretiens).where(eq(schema.entretiens.id, id));
  if (!e) return null;
  const [campagne] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, e.campagneId));
  const ets = await db.select().from(schema.etapes).where(eq(schema.etapes.entretienId, id)).orderBy(asc(schema.etapes.ordre));
  const ids = [...new Set([e.agentId, ...(e.redacteurId ? [e.redacteurId] : []), ...ets.map((x) => x.acteurId)])];
  const personnes = await db.select().from(schema.agents).where(inArray(schema.agents.id, ids));
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const agent = parId.get(e.agentId)!;
  const redacteur = e.redacteurId ? parId.get(e.redacteurId) ?? null : null;
  const etapesDetail: EtapeDetail[] = ets.map((x) => ({ ...x, acteur: parId.get(x.acteurId)!, estAgent: x.acteurId === e.agentId }));
  const objectifsServices = await db
    .select()
    .from(schema.objectifsServices)
    .where(eq(schema.objectifsServices.campagneId, e.campagneId));
  const snap = (e.snapshotAgent ?? {}) as Record<string, string | null>;
  const objDirection = [3, 4, 5, 6]
    .map((n) => objectifsServices.find((o) => o.niveau === n && o.code === snap[`niv${n}Code`] && o.texte.trim()))
    .filter(Boolean) as (typeof objectifsServices)[number][];
  const hist = await db
    .select({ h: schema.historique, nom: schema.agents.nom, prenom: schema.agents.prenom })
    .from(schema.historique)
    .leftJoin(schema.agents, eq(schema.agents.id, schema.historique.acteurId))
    .where(eq(schema.historique.entretienId, id))
    .orderBy(desc(schema.historique.at));
  const rec = await db.select().from(schema.recours).where(eq(schema.recours.entretienId, id));
  return {
    entretien: e,
    contenu: normaliserContenu(e.contenu),
    campagne,
    agent,
    snapshot: snap,
    redacteur,
    etapes: etapesDetail,
    etapeCourante: e.statut === "circuit" ? etapesDetail.find((x) => x.ordre === e.etapeCourante) ?? null : null,
    objectifsVille: campagne.objectifsVille,
    objectifsDirection: objDirection,
    historique: hist,
    recours: rec,
  };
}

export type Droits = {
  voir: boolean;
  editer: boolean;
  viser: boolean;
  /** le visa courant est celui de l'agent et l'utilisateur peut le recueillir en présence (N+1 / RH) */
  recueillirVisaPresence: boolean;
  renvoyer: boolean;
  admin: boolean;
  estAgent: boolean;
  estRedacteur: boolean;
};

export function calculerDroits(u: Agent, d: NonNullable<Dossier>): Droits {
  const e = d.entretien;
  const estAgent = u.id === e.agentId;
  const estRedacteur = u.id === e.redacteurId;
  const dansCircuit = d.etapes.some((x) => x.acteurId === u.id);
  const admin = u.isAdmin;
  const voir = admin || estAgent || estRedacteur || dansCircuit;
  const courant = d.etapeCourante;
  const superieur = !estAgent && (estRedacteur || dansCircuit);
  return {
    voir,
    editer: e.statut === "redaction" && (estRedacteur || admin),
    viser: !!courant && courant.acteurId === u.id,
    recueillirVisaPresence: !!courant && courant.estAgent && !estAgent && (estRedacteur || admin),
    renvoyer: e.statut === "circuit" && (admin || superieur),
    admin,
    estAgent,
    estRedacteur,
  };
}

/** Liste des entretiens concernant un utilisateur, pour sa page d'accueil. */
export async function entretiensDe(userId: number) {
  const camps = await db.select().from(schema.campagnes).orderBy(desc(schema.campagnes.annee));
  const viaEtapes = await db
    .selectDistinct({ id: schema.etapes.entretienId })
    .from(schema.etapes)
    .where(eq(schema.etapes.acteurId, userId));
  const directs = await db
    .select({ id: schema.entretiens.id })
    .from(schema.entretiens)
    .where(eq(schema.entretiens.redacteurId, userId));
  const ids = [...new Set([...viaEtapes.map((x) => x.id), ...directs.map((x) => x.id)])];
  const propres = await db.select({ id: schema.entretiens.id }).from(schema.entretiens).where(eq(schema.entretiens.agentId, userId));
  const tous = [...new Set([...ids, ...propres.map((x) => x.id)])];
  if (!tous.length) return { campagnes: camps, lignes: [] as LigneListe[] };
  return { campagnes: camps, lignes: await lignesListe(tous) };
}

export type LigneListe = {
  id: number;
  campagneId: number;
  annee: number;
  statut: string;
  agentId: number;
  agentNom: string;
  agentPrenom: string;
  matricule: string;
  service: string;
  redacteurId: number | null;
  redacteurNom: string;
  acteurCourantId: number | null;
  acteurCourantNom: string;
  etapeIndex: number;
  nbEtapes: number;
  derniereActionLe: Date;
  dateEntretien: string | null;
  collectivite: string;
  statutAgent: string;
  niv3: string;
  niv4: string;
};

export async function lignesListe(ids?: number[], campagneId?: number): Promise<LigneListe[]> {
  const cond = [] as ReturnType<typeof eq>[];
  if (ids) cond.push(inArray(schema.entretiens.id, ids));
  if (campagneId) cond.push(eq(schema.entretiens.campagneId, campagneId));
  const es = await db
    .select({ e: schema.entretiens, a: schema.agents, c: schema.campagnes })
    .from(schema.entretiens)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.entretiens.agentId))
    .innerJoin(schema.campagnes, eq(schema.campagnes.id, schema.entretiens.campagneId))
    .where(cond.length ? and(...cond) : undefined);
  if (!es.length) return [];
  const eids = es.map((x) => x.e.id);
  const ets = await db.select().from(schema.etapes).where(inArray(schema.etapes.entretienId, eids));
  const personnes = await db.select({ id: schema.agents.id, nom: schema.agents.nom, prenom: schema.agents.prenom }).from(schema.agents);
  const nomDe = (id: number | null) => {
    const p = personnes.find((x) => x.id === id);
    return p ? `${p.nom} ${p.prenom}`.trim() : "—";
  };
  return es.map(({ e, a, c }) => {
    const mes = ets.filter((x) => x.entretienId === e.id).sort((x, y) => x.ordre - y.ordre);
    const courant = e.statut === "circuit" ? mes.find((x) => x.ordre === e.etapeCourante) : null;
    const acteurCourantId = e.statut === "redaction" ? e.redacteurId : courant?.acteurId ?? null;
    const snap = (e.snapshotAgent ?? {}) as Record<string, string | null>;
    return {
      id: e.id,
      campagneId: e.campagneId,
      annee: c.annee,
      statut: e.statut,
      agentId: a.id,
      agentNom: a.nom,
      agentPrenom: a.prenom,
      matricule: a.matricule,
      service: [snap.niv4 ?? a.niv4, snap.niv5 ?? a.niv5].filter((x, i, t) => x && t.indexOf(x) === i).join(" › ") || (a.niv3 ?? ""),
      redacteurId: e.redacteurId,
      redacteurNom: nomDe(e.redacteurId),
      acteurCourantId,
      acteurCourantNom: e.statut === "termine" ? "—" : nomDe(acteurCourantId),
      etapeIndex: e.statut === "redaction" ? 0 : e.statut === "termine" ? mes.length + 1 : mes.findIndex((x) => x.ordre === e.etapeCourante) + 1,
      nbEtapes: mes.length + 1,
      derniereActionLe: e.derniereActionLe,
      dateEntretien: e.dateEntretien,
      collectivite: snap.collectivite ?? a.collectivite,
      statutAgent: snap.statut ?? a.statut ?? "",
      niv3: snap.niv3 ?? a.niv3 ?? "",
      niv4: snap.niv4 ?? a.niv4 ?? "",
    };
  });
}

export const nomComplet = (a: { nom: string; prenom: string } | null | undefined) => (a ? `${a.nom} ${a.prenom}`.trim() : "—");

export function libelleEtape(l: Pick<LigneListe, "statut" | "acteurCourantId" | "agentId" | "etapeIndex" | "nbEtapes">) {
  if (l.statut === "redaction") return "Rédaction par le N+1";
  if (l.statut === "termine") return "Terminé";
  if (l.acteurCourantId === l.agentId) return l.etapeIndex === l.nbEtapes - 1 ? "Visa final de l'agent" : "Visa de l'agent";
  return "Visas hiérarchiques";
}

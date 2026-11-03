import "server-only";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import type { Agent } from "@/db/schema";
import { contenuVide, normaliserContenu, type ContenuCR } from "./formulaire";
import { genererCode } from "./auth";
import { normEntete, type Grille } from "./tableur";
import { journaliser } from "./workflow";

export type Rapport = {
  simulation: boolean;
  crees: number;
  maj: number;
  inchanges: number;
  desactives: number;
  ignores: number;
  alertes: string[];
  erreurs: string[];
  codes: { matricule: string; nom: string; code: string }[];
  /** Détail lisible des changements (aperçu avant validation) */
  details: { nouveaux: string[]; departs: string[]; changements: string[]; sansEmail: number };
};
const rapportVide = (simulation = false): Rapport => ({
  simulation,
  crees: 0,
  maj: 0,
  inchanges: 0,
  desactives: 0,
  ignores: 0,
  alertes: [],
  erreurs: [],
  codes: [],
  details: { nouveaux: [], departs: [], changements: [], sansEmail: 0 },
});

/** Correspondance colonnes de l'export Inser / Ciril → champs de l'application. */
const COLONNES: Record<string, keyof Agent> = {
  MATRICULE: "matricule",
  NOM: "nom",
  PRENOM: "prenom",
  EMAIL: "email",
  STATUT: "statut",
  CATEGORIE: "categorie",
  GRADE: "grade",
  FONCTION: "poste",
  METIER: "metier",
  "TYPE TEMPS DE TRAVAIL": "tempsTravail",
  ECHELON: "echelon",
  "DATE D'ENTREE GRADE": "dateEntreeGrade",
  "CODE NIVEAU 3": "niv3Code",
  "LIBELLE NIVEAU 3": "niv3",
  "CODE NIVEAU 4": "niv4Code",
  "LIBELLE NIVEAU 4": "niv4",
  "CODE NIVEAU 5": "niv5Code",
  "LIBELLE NIVEAU 5": "niv5",
  "CODE NIVEAU 6": "niv6Code",
  "LIBELLE NIVEAU 6": "niv6",
};

const normMatricule = (m: string | null | undefined) => (m ?? "").replace(/\.0+$/, "").trim();
const dateDepassee = (s: string | null) => {
  if (!s) return false;
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s.split("/").reverse().join("-");
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
};

export function snapshotDe(a: Agent): Record<string, string | null> {
  return {
    grade: a.grade,
    poste: a.poste ?? a.metier,
    statut: a.statut,
    categorie: a.categorie,
    tempsTravail: a.tempsTravail,
    echelon: a.echelon,
    collectivite: a.collectivite,
    niv3Code: a.niv3Code,
    niv3: a.niv3,
    niv4Code: a.niv4Code,
    niv4: a.niv4,
    niv5Code: a.niv5Code,
    niv5: a.niv5,
    niv6Code: a.niv6Code,
    niv6: a.niv6,
  };
}

async function hashCode(code: string) {
  return bcrypt.hash(code, 8);
}

/** Import de l'export agents Inser / Ciril (une ligne d'en-têtes puis une ligne par agent). */
export async function importerAgents(grille: Grille, parId: number, simulation = false): Promise<Rapport> {
  const r = rapportVide(simulation);
  if (grille.length < 2) {
    r.erreurs.push("Le fichier est vide.");
    return r;
  }
  const entetes = grille[0].map((h) => normEntete(h ?? ""));
  const idx = (nom: string) => entetes.indexOf(nom);
  if (idx("MATRICULE") < 0 || idx("NOM") < 0) {
    r.erreurs.push("Colonnes MATRICULE et NOM introuvables : vérifiez que la 1re ligne contient bien les en-têtes de l'export.");
    return r;
  }
  const iDepart = idx("DATE DE DEPART");
  const colResp = (n: number) => ({ email: idx(`EMAIL RESPONSABLE NIVEAU ${n}`), nom: idx(`RESPONSABLE NIVEAU ${n}`) });
  const existants = await db.select().from(schema.agents);
  const parMatricule = new Map(existants.map((a) => [a.matricule, a]));

  for (let li = 1; li < grille.length; li++) {
    const ligne = grille[li];
    const val: Partial<Record<keyof Agent, string | null>> = {};
    for (const [col, champ] of Object.entries(COLONNES)) {
      const i = idx(col);
      if (i >= 0) val[champ] = ligne[i] ?? null;
    }
    const matricule = normMatricule(val.matricule);
    if (!matricule || !val.nom) {
      r.ignores++;
      continue;
    }
    const libelles = [val.niv3, val.niv4, val.niv5, val.niv6].join(" ").toUpperCase();
    const collectivite = /\bCCAS\b/.test(libelles) ? "CCAS" : "Ville";
    const parti = iDepart >= 0 && dateDepassee(ligne[iDepart]);
    const responsables: NonNullable<Agent["responsables"]> = {};
    for (const n of [3, 4, 5, 6] as const) {
      const c = colResp(n);
      const email = c.email >= 0 ? ligne[c.email]?.trim().toLowerCase() || null : null;
      const nomResp = c.nom >= 0 ? ligne[c.nom]?.trim() || null : null;
      if (email || nomResp) responsables[String(n) as "3"] = { email, nom: nomResp };
    }
    const donnees = {
      nom: val.nom!.trim(),
      prenom: (val.prenom ?? "").trim(),
      email: val.email?.trim().toLowerCase() || null,
      statut: val.statut ?? null,
      categorie: val.categorie ?? null,
      grade: val.grade ?? null,
      poste: val.poste ?? null,
      metier: val.metier ?? null,
      tempsTravail: val.tempsTravail ?? null,
      echelon: val.echelon ?? null,
      dateEntreeGrade: val.dateEntreeGrade ?? null,
      niv3Code: val.niv3Code ?? null,
      niv3: val.niv3 ?? null,
      niv4Code: val.niv4Code ?? null,
      niv4: val.niv4 ?? null,
      niv5Code: val.niv5Code ?? null,
      niv5: val.niv5 ?? null,
      niv6Code: val.niv6Code ?? null,
      niv6: val.niv6 ?? null,
      collectivite,
      responsables,
      updatedAt: new Date(),
    };
    const ex = parMatricule.get(matricule);
    const libelle = `${donnees.nom} ${donnees.prenom} (${matricule})`;
    if (!donnees.email && !parti) r.details.sansEmail++;
    if (!ex) r.details.nouveaux.push(`${libelle}${donnees.niv4 || donnees.niv3 ? ` – ${donnees.niv4 ?? donnees.niv3}` : ""}`);
    else if (parti && ex.actif) r.details.departs.push(libelle);
    else if (ex) {
      const diff: string[] = [];
      const cmp = (lib: string, a: string | null, b: string | null) => {
        if ((a ?? "") !== (b ?? "")) diff.push(`${lib} : ${a || "—"} → ${b || "—"}`);
      };
      cmp("service", ex.niv4 ?? ex.niv3, donnees.niv4 ?? donnees.niv3);
      cmp("grade", ex.grade, donnees.grade);
      cmp("poste", ex.poste, donnees.poste);
      cmp("statut", ex.statut, donnees.statut);
      cmp("e-mail", ex.email, donnees.email);
      if (!ex.actif && !parti) diff.push("réactivé");
      if (diff.length) r.details.changements.push(`${libelle} – ${diff.join(" ; ")}`);
      else r.inchanges++;
    }
    if (simulation) {
      if (!ex) r.crees++;
      else if (parti && ex.actif) r.desactives++;
      else r.maj++;
      continue;
    }
    try {
      if (ex) {
        await db
          .update(schema.agents)
          .set({ ...donnees, collectivite: ex.collectivite !== "Ville" ? ex.collectivite : collectivite, actif: parti ? false : ex.actif })
          .where(eq(schema.agents.id, ex.id));
        if (parti && ex.actif) r.desactives++;
        else r.maj++;
      } else {
        const code = genererCode();
        await db.insert(schema.agents).values({ matricule, ...donnees, actif: !parti, passwordHash: await hashCode(code), codeProvisoire: code, codeGenereLe: new Date(), mustChangePassword: true });
        r.crees++;
        r.codes.push({ matricule, nom: `${donnees.nom} ${donnees.prenom}`, code });
      }
    } catch (e) {
      r.erreurs.push(`Ligne ${li + 1} (matricule ${matricule}) : ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!simulation) await journaliser(null, parId, "Import agents", `${r.crees} créés, ${r.maj} mis à jour, ${r.desactives} désactivés`);
  return r;
}

/** Objectifs de l'entretien précédent → partie I du nouveau compte rendu. */
async function reprendreObjectifs(agentId: number, annee: number): Promise<ContenuCR["objectifsPrecedents"]> {
  const [prec] = await db
    .select({ contenu: schema.entretiens.contenu })
    .from(schema.entretiens)
    .innerJoin(schema.campagnes, eq(schema.campagnes.id, schema.entretiens.campagneId))
    .where(and(eq(schema.entretiens.agentId, agentId), lt(schema.campagnes.annee, annee)))
    .orderBy(desc(schema.campagnes.annee))
    .limit(1);
  if (!prec?.contenu) return [];
  return normaliserContenu(prec.contenu)
    .objectifs.filter((o) => o.objectif.trim())
    .map((o) => ({ objectif: o.objectif, ajouteEnCours: false, resultat: "", analyse: "" }));
}

/** Crée le dossier d'un agent pour une campagne avec son circuit (ou met à jour le circuit s'il est encore en rédaction). */
export async function creerOuMajDossier(campagneId: number, agent: Agent, acteurs: Agent[], parId: number): Promise<"cree" | "maj" | "verrouille"> {
  const [camp] = await db.select().from(schema.campagnes).where(eq(schema.campagnes.id, campagneId));
  const [ex] = await db
    .select()
    .from(schema.entretiens)
    .where(and(eq(schema.entretiens.campagneId, campagneId), eq(schema.entretiens.agentId, agent.id)));
  const redacteur = acteurs.find((a) => a.id !== agent.id) ?? null;
  if (ex && ex.statut !== "redaction") return "verrouille";
  let entretienId: number;
  if (ex) {
    entretienId = ex.id;
    await db
      .update(schema.entretiens)
      .set({ redacteurId: redacteur?.id ?? null, snapshotAgent: snapshotDe(agent), updatedAt: new Date() })
      .where(eq(schema.entretiens.id, ex.id));
    await db.delete(schema.etapes).where(eq(schema.etapes.entretienId, ex.id));
  } else {
    const contenu = contenuVide();
    contenu.objectifsPrecedents = await reprendreObjectifs(agent.id, camp.annee);
    contenu.fonctionRedacteur = redacteur?.poste ?? "";
    const [cree] = await db
      .insert(schema.entretiens)
      .values({ campagneId, agentId: agent.id, redacteurId: redacteur?.id ?? null, snapshotAgent: snapshotDe(agent), contenu })
      .returning({ id: schema.entretiens.id });
    entretienId = cree.id;
    await journaliser(entretienId, parId, "Dossier créé");
  }
  if (acteurs.length) await db.insert(schema.etapes).values(acteurs.map((a, i) => ({ entretienId, ordre: i + 1, acteurId: a.id })));
  return ex ? "maj" : "cree";
}

/**
 * Import du fichier « Acteurs du workflow » (format Inser) :
 * Matricule agent | Nom | Prénom | Code type entretien | Matricule acteur 1 | Nom | Matricule acteur 2 | Nom | ...
 */
export async function importerCircuits(grille: Grille, campagneId: number, parId: number): Promise<Rapport> {
  const r = rapportVide();
  if (grille.length < 2) {
    r.erreurs.push("Le fichier est vide.");
    return r;
  }
  const debut = /MATRICULE/i.test(grille[0][0] ?? "") ? 1 : 0;
  const tous = await db.select().from(schema.agents);
  const parMatricule = new Map(tous.map((a) => [a.matricule, a]));

  async function trouverOuCreer(matricule: string, nom: string | null, prenom: string | null): Promise<Agent> {
    const ex = parMatricule.get(matricule);
    if (ex) return ex;
    const code = genererCode();
    const [a] = await db
      .insert(schema.agents)
      .values({ matricule, nom: nom ?? `Matricule ${matricule}`, prenom: prenom ?? "", passwordHash: await hashCode(code), codeProvisoire: code, codeGenereLe: new Date() })
      .returning();
    parMatricule.set(matricule, a);
    r.codes.push({ matricule, nom: `${a.nom} ${a.prenom}`, code });
    r.alertes.push(`Matricule ${matricule} (${a.nom}) absent de la base agents : fiche minimale créée, à compléter par l'import agents.`);
    return a;
  }

  for (let li = debut; li < grille.length; li++) {
    const l = grille[li];
    const mat = normMatricule(l[0]);
    if (!mat) continue;
    const type = (l[3] ?? "EP").toUpperCase();
    if (type !== "EP") {
      r.ignores++;
      continue;
    }
    const agent = await trouverOuCreer(mat, l[1], l[2]);
    const acteurs: Agent[] = [];
    for (let c = 4; c < l.length; c += 2) {
      const m = normMatricule(l[c]);
      if (m) acteurs.push(await trouverOuCreer(m, l[c + 1], null));
    }
    const nom = `${agent.nom} ${agent.prenom}`.trim();
    if (acteurs.length < 2) {
      r.erreurs.push(`${nom} (${mat}) : circuit trop court, ignoré.`);
      continue;
    }
    if (acteurs[0].id !== agent.id) r.alertes.push(`${nom} (${mat}) : le circuit ne commence pas par l'agent.`);
    if (acteurs[acteurs.length - 1].id !== agent.id) r.alertes.push(`${nom} (${mat}) : le circuit ne se termine pas par l'agent (visa final manquant). À corriger dans « Agents & circuits ».`);
    for (let i = 1; i < acteurs.length; i++)
      if (acteurs[i].id === acteurs[i - 1].id) r.alertes.push(`${nom} (${mat}) : ${acteurs[i].nom} apparaît deux fois de suite dans le circuit.`);
    if (!agent.actif) r.alertes.push(`${nom} (${mat}) : agent marqué comme parti/inactif.`);
    const res = await creerOuMajDossier(campagneId, agent, acteurs, parId);
    if (res === "cree") r.crees++;
    else if (res === "maj") r.maj++;
    else {
      r.ignores++;
      r.alertes.push(`${nom} (${mat}) : dossier déjà en cours de visa ou terminé, circuit non modifié.`);
    }
  }
  await journaliser(null, parId, "Import circuits", `${r.crees} dossiers créés, ${r.maj} circuits mis à jour`);
  return r;
}

export async function agentsParIds(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(schema.agents).where(inArray(schema.agents.id, ids));
}

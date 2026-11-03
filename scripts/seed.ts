/**
 * Données FICTIVES de démonstration (aucune donnée réelle).
 * Usage : npm run db:reset   (recrée la base locale et la remplit)
 */
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";
import { contenuVide, TOUS_CRITERES, type ContenuCR } from "../src/lib/formulaire";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const db = drizzle(client, { schema });

const MDP_DEMO = "demo1234";
let seed = 42;
const alea = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const choix = <T,>(t: T[]) => t[Math.floor(alea() * t.length)];

const PRENOMS = ["Camille", "Nadia", "Julien", "Sophie", "Karim", "Laura", "Thomas", "Fatou", "Hugo", "Inès", "Marc", "Chloé", "Yanis", "Élodie", "Bruno", "Sarah", "Kevin", "Amandine", "Mehdi", "Pauline", "Olivier", "Léa", "Samir", "Claire", "Antoine", "Aïcha", "Damien", "Manon", "Rachid", "Justine", "Éric", "Morgane", "Patrick", "Lucie", "Nicolas", "Coralie", "Sébastien", "Mélanie", "David", "Émilie", "Franck", "Anaïs", "Gilles", "Océane"];
const NOMS = ["MARTIN", "BERNARD", "DUBOIS", "THOMAS", "ROBERT", "PETIT", "DURAND", "LEROY", "MOREAU", "SIMON", "LAURENT", "LEFEBVRE", "MICHEL", "GARCIA", "DAVID", "BERTRAND", "ROUX", "VINCENT", "FOURNIER", "MOREL", "GIRARD", "ANDRE", "MERCIER", "BLANC", "GUERIN", "BOYER", "GARNIER", "CHEVALIER", "FRANCOIS", "LEGRAND", "GAUTHIER", "PERRIN", "ROBIN", "CLEMENT", "MORIN", "NICOLAS", "HENRY", "ROUSSEL", "MATHIEU", "MASSON", "MARCHAND", "DUVAL", "DENIS", "LEMAIRE"];

type Pole = { code: string; libelle: string; metiers: [string, string][] };
type Direction = { code: string; libelle: string; collectivite: string; poles: Pole[] };

const DIRECTIONS: Direction[] = [
  {
    code: "D10", libelle: "DIRECTION DES SOLIDARITES ET DE L'ANIMATION URBAINE", collectivite: "Ville",
    poles: [
      { code: "P11", libelle: "POLE ENFANCE", metiers: [["Animateur.trice", "Adjoint territorial d'animation"], ["Animateur.trice - référent.e", "Adjoint territorial d'animation principal de 1ère classe"]] },
      { code: "P12", libelle: "POLE JEUNESSE ET SPORTS", metiers: [["Éducateur.trice sportif.ve", "Éducateur territorial des APS"], ["Animateur.trice jeunesse", "Animateur territorial"]] },
    ],
  },
  {
    code: "D20", libelle: "DIRECTION DES SERVICES TECHNIQUES", collectivite: "Ville",
    poles: [
      { code: "P21", libelle: "POLE ESPACES VERTS", metiers: [["Agent.e d'entretien des espaces verts", "Adjoint technique territorial"], ["Jardinier.ère", "Adjoint technique principal de 2ème classe"]] },
      { code: "P22", libelle: "POLE BATIMENTS", metiers: [["Électricien.ne", "Adjoint technique principal de 1ère classe"], ["Agent.e de maintenance", "Adjoint technique territorial"]] },
    ],
  },
  {
    code: "D30", libelle: "DIRECTION DES RESSOURCES", collectivite: "Ville",
    poles: [
      { code: "P31", libelle: "POLE RESSOURCES HUMAINES", metiers: [["Gestionnaire carrière-paie", "Rédacteur territorial"], ["Assistant.e RH", "Adjoint administratif territorial"]] },
      { code: "P32", libelle: "POLE FINANCES", metiers: [["Gestionnaire comptable", "Adjoint administratif principal de 2ème classe"]] },
    ],
  },
  {
    code: "D40", libelle: "CCAS - CENTRE COMMUNAL D'ACTION SOCIALE", collectivite: "CCAS",
    poles: [{ code: "P41", libelle: "CCAS - ACCOMPAGNEMENT SOCIAL", metiers: [["Travailleur.se social.e", "Assistant socio-éducatif"], ["Agent.e d'accueil", "Adjoint administratif territorial"]] }],
  },
];

let matriculeSuivant = 800100;
let iNom = 0;
async function creerAgent(p: Partial<typeof schema.agents.$inferInsert> & { nom?: string; prenom?: string }, opts: { email?: boolean; codeProvisoire?: boolean } = {}) {
  const prenom = p.prenom ?? PRENOMS[iNom % PRENOMS.length];
  const nom = p.nom ?? NOMS[(iNom * 7) % NOMS.length];
  iNom++;
  const matricule = p.matricule ?? String(matriculeSuivant++);
  const code = opts.codeProvisoire ? "DEMO" + matricule.slice(-4) : null;
  const [a] = await db
    .insert(schema.agents)
    .values({
      statut: "TITULAIRE",
      tempsTravail: "Temps Plein",
      collectivite: "Ville",
      ...p,
      matricule,
      nom,
      prenom,
      email: opts.email === false ? null : `${prenom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}.${nom.toLowerCase()}@exemple.fr`,
      passwordHash: await bcrypt.hash(code ?? MDP_DEMO, 8),
      codeProvisoire: code,
      codeGenereLe: code ? new Date(Date.now() - 400 * 86_400_000) : null,
      mustChangePassword: !!code,
    })
    .returning();
  return a;
}

const OBJECTIFS = [
  ["Renforcer le lien avec les familles par des temps informels de proximité", "- Présence régulière lors des temps d'entrée et de sortie\n- Repérer les besoins exprimés par les familles"],
  ["Structurer les supports écrits de l'équipe", "- Trames communes\n- Relecture partagée des documents"],
  ["Améliorer le suivi des demandes d'intervention", "- Utilisation systématique du logiciel de demandes\n- Point hebdomadaire avec le responsable"],
  ["Réduire les délais de traitement des dossiers", "- Priorisation des dossiers urgents\n- Tableau de suivi partagé"],
  ["Monter en compétence sur la sécurité au travail", "- Formation habilitation\n- Port systématique des EPI"],
  ["Développer la transversalité avec les autres services", "- Participation aux réunions inter-services\n- Partage des plannings"],
];

const APPRECIATIONS = [
  "Agent investi et fiable, qui fait preuve d'une grande disponibilité auprès des usagers. Les objectifs fixés ont été atteints.",
  "Très bonne année. L'agent a su s'adapter aux évolutions du service et apporte une vraie plus-value à l'équipe.",
  "Agent sérieux et ponctuel. Des progrès sont attendus sur l'organisation et la gestion des priorités.",
  "Implication constante, bonne posture professionnelle. L'agent est force de proposition.",
];

function contenuRempli(annee: number, precedents: ContenuCR["objectifs"], fonction: string, complet = true): ContenuCR {
  const c = contenuVide();
  c.fonctionRedacteur = fonction;
  c.objectifsPrecedents = precedents.map((o) => ({ objectif: o.objectif, ajouteEnCours: false, resultat: complet ? choix(["Réalisé", "Réalisé", "Partiellement réalisé", "En cours"]) : "", analyse: "" }));
  for (const k of TOUS_CRITERES) {
    if (!complet && alea() < 0.6) continue;
    const r = alea();
    c.criteres[k.id] = { note: r < 0.08 ? 1 : r < 0.14 ? 2 : r < 0.32 ? 3 : 4, remarque: r < 0.1 ? "À travailler en priorité" : "" };
  }
  if (complet || alea() < 0.5) {
    const n = 1 + Math.floor(alea() * 3);
    for (let i = 0; i < n; i++) {
      const [o, m] = choix(OBJECTIFS);
      c.objectifs.push({ objectif: o, moyens: m, echeance: `${annee + 1}-12-15` });
    }
  }
  if (alea() < 0.6) c.besoinsFormation.push({ initiative: choix(["Agent", "Responsable"]), catalogue: choix(["Gestion des conflits", "Habilitation électrique", "Excel perfectionnement", "Santé mentale : premiers secours", "Accueil du public"]), besoin: "Monter en compétence sur le poste", avis: choix(["Très favorable", "Favorable"]) });
  if (alea() < 0.4) c.formationsSuivies.push({ intitule: choix(["Gestes et postures", "Prévention des risques", "Logiciel métier"]), motivations: "Adaptation au poste", evaluation: "Utile", commentaires: "Acquis réinvestis au quotidien" });
  if (alea() < 0.2) c.voeux.changementInterne = { souhait: "Oui", avis: "Favorable", precision: "Intéressé.e par un poste au pôle accueil" };
  else c.voeux.changementInterne.souhait = "Non";
  c.voeux.evolutionPoste.souhait = alea() < 0.3 ? "Oui" : "Non";
  c.voeux.changementExterne.souhait = alea() < 0.05 ? "Oui" : "Non";
  if (alea() < 0.3) c.voeux.carriere = { texte: "Souhaite préparer le concours de la catégorie supérieure", avis: "Favorable" };
  c.expressionLibre = alea() < 0.5 ? "Je suis satisfait.e de mon année et souhaite continuer à progresser." : "";
  c.appreciationGenerale = complet ? choix(APPRECIATIONS) : "";
  return c;
}

const snapshot = (a: typeof schema.agents.$inferSelect) => ({
  grade: a.grade, poste: a.poste, statut: a.statut, categorie: a.categorie, tempsTravail: a.tempsTravail, echelon: a.echelon,
  collectivite: a.collectivite, niv3Code: a.niv3Code, niv3: a.niv3, niv4Code: a.niv4Code, niv4: a.niv4, niv5Code: a.niv5Code, niv5: a.niv5, niv6Code: a.niv6Code, niv6: a.niv6,
});

async function main() {
  const existe = await db.select().from(schema.agents).limit(1);
  if (existe.length) {
    console.log("La base contient déjà des données : utilisez « npm run db:reset » pour repartir de zéro.");
    return;
  }

  // RH (administratrice) et DGS
  const rh = await creerAgent({ matricule: "100001", nom: "DUPONT", prenom: "Alexia", isAdmin: true, niv3Code: "D30", niv3: "DIRECTION DES RESSOURCES", niv4Code: "P31", niv4: "POLE RESSOURCES HUMAINES", poste: "Chargée RH", grade: "Rédacteur principal de 2ème classe", categorie: "B" });
  const dgs = await creerAgent({ matricule: "100002", nom: "LAMBERT", prenom: "Véronique", poste: "Directrice générale des services", grade: "Attaché hors classe", categorie: "A", niv3Code: "D00", niv3: "DIRECTION GENERALE" });

  type Ligne = { agent: typeof schema.agents.$inferSelect; chaine: number[] };
  const lignes: Ligne[] = [];
  lignes.push({ agent: dgs, chaine: [] }); // la DGS n'a pas d'entretien dans la démo

  for (const d of DIRECTIONS) {
    const directeur = await creerAgent({ niv3Code: d.code, niv3: d.libelle, collectivite: d.collectivite, poste: "Directeur.trice", grade: "Attaché principal", categorie: "A" });
    lignes.push({ agent: directeur, chaine: [directeur.id, dgs.id, directeur.id] });
    for (const p of d.poles) {
      const chef = await creerAgent({ niv3Code: d.code, niv3: d.libelle, niv4Code: p.code, niv4: p.libelle, collectivite: d.collectivite, poste: "Responsable de pôle", grade: "Attaché territorial", categorie: "A" });
      lignes.push({ agent: chef, chaine: [chef.id, directeur.id, dgs.id, chef.id] });
      const nb = 4 + Math.floor(alea() * 3);
      for (let i = 0; i < nb; i++) {
        const [poste, grade] = choix(p.metiers);
        const technique = d.code === "D20";
        const a = await creerAgent(
          { niv3Code: d.code, niv3: d.libelle, niv4Code: p.code, niv4: p.libelle, niv5Code: p.code, niv5: p.libelle, collectivite: d.collectivite, poste, grade, categorie: grade.startsWith("Adjoint") ? "C" : "B", statut: alea() < 0.15 ? "CONTRACTUEL" : "TITULAIRE", tempsTravail: alea() < 0.15 ? "Temps partiel 80 %" : "Temps Plein", echelon: String(1 + Math.floor(alea() * 10)) },
          { email: !(technique && alea() < 0.6), codeProvisoire: technique && alea() < 0.5 },
        );
        lignes.push({ agent: a, chaine: [a.id, chef.id, directeur.id, dgs.id, a.id] });
      }
    }
  }
  // La RH est rattachée au pôle RH
  const chefRh = lignes.find((l) => l.agent.niv4Code === "P31" && l.agent.poste === "Responsable de pôle")!.agent;
  const dirRes = lignes.find((l) => l.agent.niv3Code === "D30" && l.agent.poste === "Directeur.trice")!.agent;
  lignes.push({ agent: rh, chaine: [rh.id, chefRh.id, dirRes.id, dgs.id, rh.id] });

  // Organigramme (colonnes RESPONSABLE NIVEAU x de l'export) : niveau 4 = chef de pôle, niveau 3 = directeur
  const parId = new Map(lignes.map((l) => [l.agent.id, l.agent]));
  for (const { agent, chaine } of lignes) {
    const sup = chaine.slice(1, -1).filter((id) => id !== dgs.id).map((id) => parId.get(id)!);
    const resp: Record<string, { email: string | null; nom: string }> = {};
    if (sup.length === 2) {
      resp["4"] = { email: sup[0].email, nom: `${sup[0].nom} ${sup[0].prenom}` };
      resp["3"] = { email: sup[1].email, nom: `${sup[1].nom} ${sup[1].prenom}` };
    } else if (sup.length === 1) resp["3"] = { email: sup[0].email, nom: `${sup[0].nom} ${sup[0].prenom}` };
    if (Object.keys(resp).length) await db.update(schema.agents).set({ responsables: resp }).where(eq(schema.agents.id, agent.id));
  }

  // Campagne 2025 : terminée
  const objectifsVille =
    "La commune de Saint-Jean-de-la-Ruelle maintient ses objectifs ambitieux afin de répondre aux attentes de ses citoyens, tout en prenant en compte les défis budgétaires et en confortant la qualité de vie au travail de ses agents.\n\n1/ Œuvrer à la qualité de vie des habitants, et améliorer la qualité de service de façon continue, en proximité\n2/ Optimiser les ressources et favoriser la sobriété des usages\n3/ Promouvoir nos Ressources Humaines : responsabiliser et impliquer les équipes";
  const [c25] = await db.insert(schema.campagnes).values({ annee: 2025, titre: "Entretiens professionnels 2025", dateDebut: "2025-11-01", dateLimite: "2026-01-31", objectifsVille, statut: "close" }).returning();
  const [c26] = await db.insert(schema.campagnes).values({ annee: 2026, titre: "Entretiens professionnels 2026", dateDebut: "2026-11-01", dateLimite: "2026-12-31", objectifsVille, relanceJours: 5, viseurFinalId: dgs.id }).returning();
  await db.insert(schema.objectifsServices).values([
    { campagneId: c26.id, niveau: 3, code: "D10", libelle: DIRECTIONS[0].libelle, texte: "Garantir un cadre éducatif cohérent, sécurisant et inclusif, favorisant l'épanouissement de tous les enfants." },
    { campagneId: c26.id, niveau: 4, code: "P11", libelle: "POLE ENFANCE", texte: "Accompagner la structuration et la stabilisation du pôle enfance par un pilotage partagé et un soutien constant aux équipes." },
    { campagneId: c26.id, niveau: 3, code: "D20", libelle: DIRECTIONS[1].libelle, texte: "Réduire la consommation énergétique des bâtiments publics et améliorer les délais d'intervention." },
  ]);

  const jour = 86_400_000;
  const maintenant = Date.now();
  const tous = lignes.filter((l) => l.chaine.length);
  let i = 0;
  for (const { agent, chaine } of tous) {
    const redacteurId = chaine[1];
    const [redac] = await db.select().from(schema.agents).where(eq(schema.agents.id, redacteurId));
    // 2025 : terminé
    const c2025 = contenuRempli(2025, [], redac.poste ?? "");
    const debut25 = new Date("2025-12-10T10:00:00").getTime();
    const [e25] = await db
      .insert(schema.entretiens)
      .values({ campagneId: c25.id, agentId: agent.id, redacteurId, statut: "termine", etapeCourante: chaine.length, dateEntretien: "2025-12-10", snapshotAgent: snapshot(agent), contenu: c2025, visaRedacteurLe: new Date(debut25 + jour * 5), termineLe: new Date(debut25 + jour * (6 + chaine.length * 2)), derniereActionLe: new Date(debut25 + jour * (6 + chaine.length * 2)) })
      .returning();
    await db.insert(schema.etapes).values(chaine.map((id, k) => ({ entretienId: e25.id, ordre: k + 1, acteurId: id, viseLe: new Date(debut25 + jour * (6 + k * 2)), modeVisa: "en_ligne", enregistreParId: id })));

    // 2026 : états variés
    const r = i++ % 10;
    const statut = r < 3 ? "redaction" : r < 8 ? "circuit" : "termine";
    const complet = statut !== "redaction" || r === 2;
    const c2026 = contenuRempli(2026, c2025.objectifs, redac.poste ?? "", complet);
    if (statut === "redaction" && r === 0) {
      // dossier pas encore commencé
      c2026.criteres = contenuVide().criteres;
      c2026.objectifs = [];
      c2026.besoinsFormation = [];
      c2026.appreciationGenerale = "";
      c2026.objectifsPrecedents = c2026.objectifsPrecedents.map((o) => ({ ...o, resultat: "" }));
    }
    // agents sans e-mail en circuit : en attente de leur visa (papier) pour la démo « Visas papier »
    const nbVises = statut === "termine" ? chaine.length : statut === "circuit" ? (agent.email ? Math.floor(alea() * (chaine.length - 1)) : 0) : 0;
    const age = Math.floor(alea() * 12);
    const derniere = new Date(maintenant - age * jour);
    const [e26] = await db
      .insert(schema.entretiens)
      .values({
        campagneId: c26.id,
        agentId: agent.id,
        redacteurId,
        statut,
        etapeCourante: statut === "circuit" ? nbVises + 1 : statut === "termine" ? chaine.length : 0,
        dateEntretien: complet ? "2026-11-0" + (1 + (i % 9)) : null,
        convocationLe: complet ? `2026-11-0${1 + (i % 9)}T10:00` : r === 0 && i % 2 ? "2026-11-20T14:30" : null,
        convocationLieu: complet || (r === 0 && i % 2) ? "Bureau du responsable" : null,
        convocationEnvoyeeLe: complet || (r === 0 && i % 2) ? new Date(maintenant - 20 * jour) : null,
        snapshotAgent: snapshot(agent),
        contenu: c2026,
        visaRedacteurLe: statut !== "redaction" ? new Date(maintenant - (age + nbVises + 1) * jour) : null,
        termineLe: statut === "termine" ? derniere : null,
        derniereActionLe: derniere,
      })
      .returning();
    await db.insert(schema.etapes).values(
      chaine.map((id, k) => ({
        entretienId: e26.id,
        ordre: k + 1,
        acteurId: id,
        viseLe: k < nbVises ? new Date(maintenant - (age + nbVises - k) * jour) : null,
        modeVisa: k < nbVises ? (id === agent.id && !agent.email ? "papier" : "en_ligne") : null,
        observations: k < nbVises && id !== agent.id && alea() < 0.2 ? "Vu, d'accord avec l'appréciation." : null,
        enregistreParId: k < nbVises ? id : null,
      })),
    );
    await db.insert(schema.historique).values({ entretienId: e26.id, action: "Dossier créé (données de démonstration)" });
  }
  console.log(`Base de démonstration créée : ${lignes.length} agents, ${tous.length} dossiers par campagne.`);
  console.log(`Connexion RH : matricule 100001 / mot de passe ${MDP_DEMO}`);
  console.log(`Connexion DGS : matricule 100002 / mot de passe ${MDP_DEMO}`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });

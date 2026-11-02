/**
 * Définition du compte rendu d'entretien professionnel (modèle Ville de Saint-Jean-de-la-Ruelle).
 * Pour modifier un libellé ou ajouter un critère, c'est ici (voir docs/GUIDE_MAINTENANCE.md).
 */

export const ECHELLE = [
  { valeur: 1, libelle: "Sans objet", court: "Sans objet" },
  { valeur: 2, libelle: "Exigences du poste non satisfaites", court: "Non satisfaites" },
  { valeur: 3, libelle: "Améliorations à rechercher", court: "À améliorer" },
  { valeur: 4, libelle: "Exigences du poste satisfaites", court: "Satisfaites" },
] as const;

export type Critere = { id: string; libelle: string };
export type GroupeCriteres = { titre: string; criteres: Critere[] };
export type Rubrique = { titre: string; groupes: GroupeCriteres[] };

export const RUBRIQUES: Rubrique[] = [
  {
    titre: "L'agent et sa mission",
    groupes: [
      {
        titre: "Aptitudes techniques",
        criteres: [
          { id: "outils", libelle: "Connaître et maîtriser les outils, les procédures et le langage nécessaires à l'exercice de ses fonctions" },
          { id: "environnement", libelle: "Demeurer au fait de l'environnement professionnel et de l'actualité de la collectivité" },
        ],
      },
      {
        titre: "Respect des directives et du travail",
        criteres: [
          { id: "procedures", libelle: "Respecter les procédures et les délais" },
          { id: "economie", libelle: "Avoir le souci de l'économie" },
          { id: "remarques", libelle: "Accepter les remarques et en tenir compte" },
        ],
      },
      {
        titre: "Qualité du service",
        criteres: [
          { id: "organisation", libelle: "S'organiser et planifier ses tâches (gérer les priorités)" },
          { id: "efficacite", libelle: "Exécuter le travail avec efficacité et fiabilité" },
        ],
      },
      {
        titre: "Qualité des relations avec le public ou les partenaires",
        criteres: [
          { id: "accueil", libelle: "Accueillir, orienter et conseiller le public ou les partenaires avec courtoisie quelles que soient les circonstances" },
        ],
      },
    ],
  },
  {
    titre: "L'agent dans son équipe et dans son environnement de travail",
    groupes: [
      {
        titre: "Qualité des relations au sein de l'équipe et de la direction",
        criteres: [
          { id: "equipe", libelle: "Avoir l'esprit d'équipe" },
          { id: "alerter", libelle: "Alerter des difficultés et des dysfonctionnements rencontrés dans son travail – rendre compte à sa hiérarchie" },
          { id: "securite", libelle: "Respect des consignes de sécurité (par exemple : port des EPI)" },
          { id: "materiel", libelle: "Soin dans l'utilisation du matériel" },
        ],
      },
    ],
  },
  {
    titre: "L'agent et son aptitude au travail",
    groupes: [
      { titre: "", criteres: [{ id: "ponctualite", libelle: "Ponctualité" }] },
      {
        titre: "Implication",
        criteres: [
          { id: "mobilisation", libelle: "Se mobiliser en fonction des nécessités de service" },
          { id: "dynamisme", libelle: "Faire preuve de dynamisme, d'esprit d'initiative et d'autonomie dans l'accomplissement de ses tâches" },
        ],
      },
    ],
  },
];

export const TOUS_CRITERES: Critere[] = RUBRIQUES.flatMap((r) => r.groupes.flatMap((g) => g.criteres));

export const RESULTATS = ["Réalisé", "Partiellement réalisé", "Non réalisé", "En cours", "Abandonné / sans objet"];
export const INITIATIVES = ["Agent", "Responsable"];
export const AVIS = ["Très favorable", "Favorable", "Réservé", "Défavorable"];

export type ObjectifPrecedent = { objectif: string; ajouteEnCours: boolean; resultat: string; analyse: string };
export type ObjectifNouveau = { objectif: string; moyens: string; echeance: string };
export type FormationSuivie = { intitule: string; motivations: string; evaluation: string; commentaires: string };
export type BesoinFormation = { initiative: string; catalogue: string; besoin: string; avis: string };
export type VoeuMobilite = { souhait: "" | "Oui" | "Non"; avis: string; precision: string };
export type VoeuTexte = { texte: string; avis: string };

export type ContenuCR = {
  fonctionRedacteur: string;
  objectifsPrecedents: ObjectifPrecedent[];
  expressionLibre: string;
  carriere: {
    echelon: boolean;
    echelonDateEffet: string;
    grade: boolean;
    gradeDateExamen: string;
    promotion: boolean;
    promotionDateExamen1: string;
    promotionDateExamen2: string;
    avisAvancementGrade: string;
    avisPromotion1: string;
    avisPromotion2: string;
  };
  criteres: Record<string, { note: number | null; remarque: string }>;
  objectifs: ObjectifNouveau[];
  formationsSuivies: FormationSuivie[];
  remarquesFormations: string;
  besoinsFormation: BesoinFormation[];
  voeux: {
    carriere: VoeuTexte;
    evolutionPoste: VoeuMobilite;
    changementInterne: VoeuMobilite;
    changementExterne: VoeuMobilite;
    environnement: VoeuTexte;
    organisation: VoeuTexte;
    autres: VoeuTexte;
  };
  appreciationGenerale: string;
};

const voeuMob = (): VoeuMobilite => ({ souhait: "", avis: "", precision: "" });
const voeuTxt = (): VoeuTexte => ({ texte: "", avis: "" });

export function contenuVide(): ContenuCR {
  return {
    fonctionRedacteur: "",
    objectifsPrecedents: [],
    expressionLibre: "",
    carriere: {
      echelon: false,
      echelonDateEffet: "",
      grade: false,
      gradeDateExamen: "",
      promotion: false,
      promotionDateExamen1: "",
      promotionDateExamen2: "",
      avisAvancementGrade: "",
      avisPromotion1: "",
      avisPromotion2: "",
    },
    criteres: Object.fromEntries(TOUS_CRITERES.map((c) => [c.id, { note: null, remarque: "" }])),
    objectifs: [],
    formationsSuivies: [],
    remarquesFormations: "",
    besoinsFormation: [],
    voeux: {
      carriere: voeuTxt(),
      evolutionPoste: voeuMob(),
      changementInterne: voeuMob(),
      changementExterne: voeuMob(),
      environnement: voeuTxt(),
      organisation: voeuTxt(),
      autres: voeuTxt(),
    },
    appreciationGenerale: "",
  };
}

/** Complète un contenu partiel (ancien format, import...) avec les valeurs par défaut. */
export function normaliserContenu(c: Partial<ContenuCR> | null | undefined): ContenuCR {
  const base = contenuVide();
  if (!c) return base;
  return {
    ...base,
    ...c,
    carriere: { ...base.carriere, ...(c.carriere ?? {}) },
    criteres: { ...base.criteres, ...(c.criteres ?? {}) },
    voeux: {
      carriere: { ...base.voeux.carriere, ...(c.voeux?.carriere ?? {}) },
      evolutionPoste: { ...base.voeux.evolutionPoste, ...(c.voeux?.evolutionPoste ?? {}) },
      changementInterne: { ...base.voeux.changementInterne, ...(c.voeux?.changementInterne ?? {}) },
      changementExterne: { ...base.voeux.changementExterne, ...(c.voeux?.changementExterne ?? {}) },
      environnement: { ...base.voeux.environnement, ...(c.voeux?.environnement ?? {}) },
      organisation: { ...base.voeux.organisation, ...(c.voeux?.organisation ?? {}) },
      autres: { ...base.voeux.autres, ...(c.voeux?.autres ?? {}) },
    },
  };
}

/** Points bloquants avant que le N+1 puisse viser et lancer le circuit. */
export function verifierCompletude(c: ContenuCR, dateEntretien: string | null): string[] {
  const manques: string[] = [];
  if (!dateEntretien) manques.push("La date de l'entretien n'est pas renseignée.");
  const nonNotes = TOUS_CRITERES.filter((k) => !c.criteres[k.id]?.note);
  if (nonNotes.length) manques.push(`${nonNotes.length} critère(s) de la partie III ne sont pas appréciés.`);
  if (c.objectifs.filter((o) => o.objectif.trim()).length === 0) manques.push("Aucun objectif individuel n'est fixé (partie IV).");
  if (!c.appreciationGenerale.trim()) manques.push("L'appréciation générale n'est pas rédigée.");
  const sansResultat = c.objectifsPrecedents.filter((o) => o.objectif.trim() && !o.resultat);
  if (sansResultat.length) manques.push(`${sansResultat.length} objectif(s) de l'an dernier sans résultat indiqué (partie I).`);
  return manques;
}

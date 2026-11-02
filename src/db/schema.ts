import { sqliteTable, text, integer, blob, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = sql`(unixepoch() * 1000)`;

/** Agents et utilisateurs (un agent = un compte). */
export const agents = sqliteTable(
  "agents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matricule: text("matricule").notNull(),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull().default(""),
    email: text("email"),
    collectivite: text("collectivite").notNull().default("Ville"), // Ville | CCAS
    statut: text("statut"), // TITULAIRE, CONTRACTUEL...
    categorie: text("categorie"),
    grade: text("grade"),
    poste: text("poste"), // intitulé du poste (fonction)
    metier: text("metier"),
    tempsTravail: text("temps_travail"),
    echelon: text("echelon"),
    dateEntreeGrade: text("date_entree_grade"),
    niv3Code: text("niv3_code"),
    niv3: text("niv3"),
    niv4Code: text("niv4_code"),
    niv4: text("niv4"),
    niv5Code: text("niv5_code"),
    niv5: text("niv5"),
    niv6Code: text("niv6_code"),
    niv6: text("niv6"),
    actif: integer("actif", { mode: "boolean" }).notNull().default(true),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    passwordHash: text("password_hash"),
    /** Code provisoire remis par les RH (en clair tant qu'il n'est pas changé, pour pouvoir l'imprimer). */
    codeProvisoire: text("code_provisoire"),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
    derniereConnexion: integer("derniere_connexion", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [uniqueIndex("agents_matricule_idx").on(t.matricule)],
);

/** Une campagne = une année d'entretiens. */
export const campagnes = sqliteTable("campagnes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  annee: integer("annee").notNull(),
  titre: text("titre").notNull(),
  dateDebut: text("date_debut"),
  dateLimite: text("date_limite"),
  objectifsVille: text("objectifs_ville").notNull().default(""),
  relanceJours: integer("relance_jours").notNull().default(5),
  statut: text("statut").notNull().default("ouverte"), // ouverte | close
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

/** Objectifs d'une direction / d'un pôle pour une campagne (rattachés à un code de niveau). */
export const objectifsServices = sqliteTable(
  "objectifs_services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campagneId: integer("campagne_id").notNull().references(() => campagnes.id, { onDelete: "cascade" }),
    niveau: integer("niveau").notNull(), // 3, 4, 5 ou 6
    code: text("code").notNull(),
    libelle: text("libelle").notNull(),
    texte: text("texte").notNull().default(""),
  },
  (t) => [uniqueIndex("obj_serv_idx").on(t.campagneId, t.niveau, t.code)],
);

/** Un entretien = un agent pour une campagne. Le contenu du formulaire est stocké en JSON. */
export const entretiens = sqliteTable(
  "entretiens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campagneId: integer("campagne_id").notNull().references(() => campagnes.id, { onDelete: "cascade" }),
    agentId: integer("agent_id").notNull().references(() => agents.id),
    redacteurId: integer("redacteur_id").references(() => agents.id), // N+1
    /** redaction | circuit | termine */
    statut: text("statut").notNull().default("redaction"),
    /** ordre de l'étape de visa en cours (quand statut = circuit) */
    etapeCourante: integer("etape_courante").notNull().default(0),
    /** date de l'entretien (AAAA-MM-JJ) */
    dateEntretien: text("date_entretien"),
    /** Instantané des infos agent au moment de la campagne (grade, poste, service...) */
    snapshotAgent: text("snapshot_agent", { mode: "json" }).$type<Record<string, string | null>>(),
    contenu: text("contenu", { mode: "json" }).$type<import("@/lib/formulaire").ContenuCR>(),
    visaRedacteurLe: integer("visa_redacteur_le", { mode: "timestamp_ms" }),
    termineLe: integer("termine_le", { mode: "timestamp_ms" }),
    derniereActionLe: integer("derniere_action_le", { mode: "timestamp_ms" }).notNull().default(now),
    derniereRelanceLe: integer("derniere_relance_le", { mode: "timestamp_ms" }),
    pdfEnvoyeLe: integer("pdf_envoye_le", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [uniqueIndex("entretien_unique_idx").on(t.campagneId, t.agentId), index("entretien_redacteur_idx").on(t.redacteurId)],
);

/** Étapes du circuit de visas (agent → N+1 → N+2 → ... → agent). */
export const etapes = sqliteTable(
  "etapes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entretienId: integer("entretien_id").notNull().references(() => entretiens.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull(),
    acteurId: integer("acteur_id").notNull().references(() => agents.id),
    viseLe: integer("vise_le", { mode: "timestamp_ms" }),
    observations: text("observations"),
    /** en_ligne | en_presence | papier */
    modeVisa: text("mode_visa"),
    /** qui a enregistré le visa (différent de l'acteur pour un visa papier saisi par les RH) */
    enregistreParId: integer("enregistre_par_id").references(() => agents.id),
  },
  (t) => [index("etapes_entretien_idx").on(t.entretienId), index("etapes_acteur_idx").on(t.acteurId)],
);

/** Journal de toutes les actions (traçabilité des visas et modifications). */
export const historique = sqliteTable(
  "historique",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entretienId: integer("entretien_id").references(() => entretiens.id, { onDelete: "cascade" }),
    acteurId: integer("acteur_id").references(() => agents.id),
    action: text("action").notNull(),
    details: text("details"),
    at: integer("at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (t) => [index("historique_entretien_idx").on(t.entretienId)],
);

/** Demandes de révision (autorité territoriale puis CAP). */
export const recours = sqliteTable("recours", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entretienId: integer("entretien_id").notNull().references(() => entretiens.id, { onDelete: "cascade" }),
  dateDemande: text("date_demande"),
  dateReponse: text("date_reponse"),
  decision: text("decision"), // en_cours | rejet | revision_acceptee | revision_partielle
  saisineCapLe: text("saisine_cap_le"),
  avisCap: text("avis_cap"),
  commentaire: text("commentaire"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

/** PDF définitif figé au dernier visa (archive : il ne change plus, même si le modèle évolue). */
export const pdfsDefinitifs = sqliteTable("pdfs_definitifs", {
  entretienId: integer("entretien_id").primaryKey().references(() => entretiens.id, { onDelete: "cascade" }),
  contenu: blob("contenu", { mode: "buffer" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

/** Journal des e-mails (envoyés ou simplement journalisés si le SMTP n'est pas configuré). */
export const emails = sqliteTable("emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  destinataire: text("destinataire").notNull(),
  sujet: text("sujet").notNull(),
  corps: text("corps").notNull(),
  type: text("type").notNull(), // tour | relance | final | autre
  entretienId: integer("entretien_id"),
  statut: text("statut").notNull(), // envoye | journalise | erreur
  erreur: text("erreur"),
  at: integer("at", { mode: "timestamp_ms" }).notNull().default(now),
});

export type Agent = typeof agents.$inferSelect;
export type Campagne = typeof campagnes.$inferSelect;
export type Entretien = typeof entretiens.$inferSelect;
export type Etape = typeof etapes.$inferSelect;

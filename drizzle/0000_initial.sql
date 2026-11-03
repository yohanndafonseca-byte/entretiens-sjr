CREATE TABLE `agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`matricule` text NOT NULL,
	`nom` text NOT NULL,
	`prenom` text DEFAULT '' NOT NULL,
	`email` text,
	`collectivite` text DEFAULT 'Ville' NOT NULL,
	`statut` text,
	`categorie` text,
	`grade` text,
	`poste` text,
	`metier` text,
	`temps_travail` text,
	`echelon` text,
	`date_entree_grade` text,
	`niv3_code` text,
	`niv3` text,
	`niv4_code` text,
	`niv4` text,
	`niv5_code` text,
	`niv5` text,
	`niv6_code` text,
	`niv6` text,
	`actif` integer DEFAULT true NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`code_provisoire` text,
	`must_change_password` integer DEFAULT true NOT NULL,
	`derniere_connexion` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_matricule_idx` ON `agents` (`matricule`);--> statement-breakpoint
CREATE TABLE `campagnes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`annee` integer NOT NULL,
	`titre` text NOT NULL,
	`date_debut` text,
	`date_limite` text,
	`objectifs_ville` text DEFAULT '' NOT NULL,
	`relance_jours` integer DEFAULT 5 NOT NULL,
	`statut` text DEFAULT 'ouverte' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`destinataire` text NOT NULL,
	`sujet` text NOT NULL,
	`corps` text NOT NULL,
	`type` text NOT NULL,
	`entretien_id` integer,
	`statut` text NOT NULL,
	`erreur` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entretiens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campagne_id` integer NOT NULL,
	`agent_id` integer NOT NULL,
	`redacteur_id` integer,
	`statut` text DEFAULT 'redaction' NOT NULL,
	`etape_courante` integer DEFAULT 0 NOT NULL,
	`date_entretien` text,
	`snapshot_agent` text,
	`contenu` text,
	`visa_redacteur_le` integer,
	`termine_le` integer,
	`derniere_action_le` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`derniere_relance_le` integer,
	`pdf_envoye_le` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`campagne_id`) REFERENCES `campagnes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redacteur_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entretien_unique_idx` ON `entretiens` (`campagne_id`,`agent_id`);--> statement-breakpoint
CREATE INDEX `entretien_redacteur_idx` ON `entretiens` (`redacteur_id`);--> statement-breakpoint
CREATE TABLE `etapes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entretien_id` integer NOT NULL,
	`ordre` integer NOT NULL,
	`acteur_id` integer NOT NULL,
	`vise_le` integer,
	`observations` text,
	`mode_visa` text,
	`enregistre_par_id` integer,
	FOREIGN KEY (`entretien_id`) REFERENCES `entretiens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acteur_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`enregistre_par_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `etapes_entretien_idx` ON `etapes` (`entretien_id`);--> statement-breakpoint
CREATE INDEX `etapes_acteur_idx` ON `etapes` (`acteur_id`);--> statement-breakpoint
CREATE TABLE `historique` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entretien_id` integer,
	`acteur_id` integer,
	`action` text NOT NULL,
	`details` text,
	`at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entretien_id`) REFERENCES `entretiens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acteur_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `historique_entretien_idx` ON `historique` (`entretien_id`);--> statement-breakpoint
CREATE TABLE `objectifs_services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campagne_id` integer NOT NULL,
	`niveau` integer NOT NULL,
	`code` text NOT NULL,
	`libelle` text NOT NULL,
	`texte` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`campagne_id`) REFERENCES `campagnes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `obj_serv_idx` ON `objectifs_services` (`campagne_id`,`niveau`,`code`);--> statement-breakpoint
CREATE TABLE `pdfs_definitifs` (
	`entretien_id` integer PRIMARY KEY NOT NULL,
	`contenu` blob NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entretien_id`) REFERENCES `entretiens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entretien_id` integer NOT NULL,
	`date_demande` text,
	`date_reponse` text,
	`decision` text,
	`saisine_cap_le` text,
	`avis_cap` text,
	`commentaire` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`entretien_id`) REFERENCES `entretiens`(`id`) ON UPDATE no action ON DELETE cascade
);

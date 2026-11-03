ALTER TABLE `agents` ADD `responsables` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `circuit_personnalise` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `hors_campagne` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campagnes` ADD `viseur_final_id` integer;--> statement-breakpoint
ALTER TABLE `entretiens` ADD `convocation_le` text;--> statement-breakpoint
ALTER TABLE `entretiens` ADD `convocation_lieu` text;--> statement-breakpoint
ALTER TABLE `entretiens` ADD `convocation_envoyee_le` integer;--> statement-breakpoint
ALTER TABLE `entretiens` ADD `fiche_poste_nom` text;--> statement-breakpoint
ALTER TABLE `entretiens` ADD `fiche_poste` blob;
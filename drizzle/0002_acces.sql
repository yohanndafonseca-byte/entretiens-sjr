ALTER TABLE `agents` ADD `profil_acces` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `code_genere_le` integer;--> statement-breakpoint
ALTER TABLE `agents` ADD `tentatives_echouees` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `bloque_jusqua` integer;--> statement-breakpoint
ALTER TABLE `agents` ADD `reset_jeton` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `reset_expire` integer;
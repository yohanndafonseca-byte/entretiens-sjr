// Applique les migrations de la base (dossier drizzle/) – lancé automatiquement avant chaque build.
// Idempotent : ne fait rien si la base est déjà à jour. Ne supprime jamais de données.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:local.db";
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
console.log(`Base de données à jour (${url.startsWith("file:") ? "fichier local" : "Turso"}).`);
client.close();

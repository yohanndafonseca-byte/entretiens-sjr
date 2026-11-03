// Applique les migrations de la base (dossier drizzle/) – lancé automatiquement avant chaque build.
// Idempotent : ne fait rien si la base est déjà à jour. Ne supprime jamais de données.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:local.db";

// Sur Vercel, une base fichier serait effacée à chaque déploiement : on exige Turso.
if (process.env.VERCEL) {
  const manquantes = ["DATABASE_URL", "DATABASE_AUTH_TOKEN", "SESSION_SECRET"].filter((v) => !process.env[v]);
  if (manquantes.length || !url.startsWith("libsql://")) {
    console.error(
      "\n❌ Configuration incomplète dans Vercel (Settings → Environment Variables) :\n" +
        (manquantes.length ? `   variable(s) manquante(s) : ${manquantes.join(", ")}\n` : "") +
        (!url.startsWith("libsql://") && process.env.DATABASE_URL ? "   DATABASE_URL doit commencer par libsql://\n" : "") +
        "   Ajoutez-les puis relancez le déploiement (Deployments → … → Redeploy).\n",
    );
    process.exit(1);
  }
}
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
console.log(`Base de données à jour (${url.startsWith("file:") ? "fichier local" : "Turso"}).`);
client.close();

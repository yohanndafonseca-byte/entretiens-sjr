import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { Coquille } from "@/components/Entete";

export const dynamic = "force-dynamic";

export default async function PageEmails() {
  const u = await exigerAdmin();
  const mails = await db.select().from(schema.emails).orderBy(desc(schema.emails.at)).limit(300);
  const smtp = !!process.env.SMTP_HOST;
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">E-mails</h1>
      <p className={`mb-4 rounded-lg p-3 text-sm ${smtp ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-sjr-attente-doux text-yellow-900"}`}>
        {smtp
          ? "Le serveur d'envoi (SMTP) est configuré : les e-mails partent réellement."
          : "Aucun serveur d'envoi (SMTP) n'est configuré : les e-mails sont seulement enregistrés ci-dessous, rien ne part. Voir le guide de maintenance."}
      </p>
      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead><tr><th>Date</th><th>Type</th><th>Destinataire</th><th>Sujet</th><th>État</th></tr></thead>
          <tbody>
            {mails.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap text-xs">{m.at.toLocaleString("fr-FR")}</td>
                <td className="text-xs">{m.type}</td>
                <td className="text-xs">{m.destinataire}</td>
                <td>
                  <details><summary className="cursor-pointer text-sm">{m.sujet}</summary><pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-gray-600">{m.corps}</pre></details>
                </td>
                <td className="text-xs">{m.statut === "envoye" ? "✓ envoyé" : m.statut === "erreur" ? <span className="text-red-700" title={m.erreur ?? ""}>✗ erreur</span> : "journalisé"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!mails.length && <p className="p-6 text-sm text-gray-500">Aucun e-mail pour l'instant.</p>}
      </div>
    </Coquille>
  );
}

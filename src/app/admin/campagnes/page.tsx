import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { enregistrerCampagne } from "@/app/admin/actions";
import { Coquille } from "@/components/Entete";

export const dynamic = "force-dynamic";

export default async function PageCampagnes() {
  const u = await exigerAdmin();
  const camps = await db
    .select({ c: schema.campagnes, nb: sql<number>`(select count(*) from entretiens e where e.campagne_id = ${schema.campagnes.id})` })
    .from(schema.campagnes)
    .orderBy(desc(schema.campagnes.annee));
  const annee = new Date().getFullYear();
  return (
    <Coquille u={u}>
      <h1 className="mb-4 text-2xl font-bold">Campagnes</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="carte overflow-hidden">
          <table className="tableau">
            <thead><tr><th>Année</th><th>Titre</th><th>Période</th><th>Dossiers</th><th>État</th><th></th></tr></thead>
            <tbody>
              {camps.map(({ c, nb }) => (
                <tr key={c.id}>
                  <td className="font-bold">{c.annee}</td>
                  <td>{c.titre}</td>
                  <td className="text-xs">{c.dateDebut?.split("-").reverse().join("/") ?? "—"} → {c.dateLimite?.split("-").reverse().join("/") ?? "—"}</td>
                  <td>{nb}</td>
                  <td>{c.statut === "ouverte" ? <span className="badge bg-sjr-primaire-doux text-sjr-primaire-fonce">ouverte</span> : <span className="badge bg-gray-100 text-gray-600">close</span>}</td>
                  <td className="text-right"><Link href={`/admin/campagnes/${c.id}`} className="btn-secondaire py-1 text-xs">Paramétrer</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!camps.length && <p className="p-6 text-sm text-gray-500">Aucune campagne pour l'instant.</p>}
        </div>
        <form action={enregistrerCampagne} className="carte space-y-3 p-5">
          <h2 className="titre-section">Nouvelle campagne</h2>
          <div><label className="etiquette">Année évaluée</label><input name="annee" type="number" defaultValue={annee} className="champ" required /></div>
          <div><label className="etiquette">Titre</label><input name="titre" defaultValue={`Entretiens professionnels ${annee}`} className="champ" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="etiquette">Début</label><input name="dateDebut" type="date" defaultValue={`${annee}-11-01`} className="champ" /></div>
            <div><label className="etiquette">Date limite</label><input name="dateLimite" type="date" defaultValue={`${annee}-12-31`} className="champ" /></div>
          </div>
          <div><label className="etiquette">Relance après (jours sans action)</label><input name="relanceJours" type="number" min={1} defaultValue={5} className="champ" /></div>
          <button className="btn-primaire w-full">Créer</button>
        </form>
      </div>
    </Coquille>
  );
}

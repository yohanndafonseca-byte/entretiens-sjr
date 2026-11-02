import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { exigerAdmin } from "@/lib/auth";
import { campagneParId } from "@/lib/campagne";
import { enregistrerCampagne, enregistrerObjectifsService } from "@/app/admin/actions";
import { Coquille } from "@/components/Entete";

export const dynamic = "force-dynamic";

export default async function PageCampagne({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerAdmin();
  const c = await campagneParId(Number((await params).id));
  if (!c) notFound();
  const agents = await db.select().from(schema.agents).where(eq(schema.agents.actif, true));
  const objs = await db.select().from(schema.objectifsServices).where(eq(schema.objectifsServices.campagneId, c.id));

  // Directions (niveau 3) et pôles (niveau 4) présents dans la base agents
  const services = new Map<string, { niveau: number; code: string; libelle: string; parent?: string }>();
  for (const a of agents) {
    if (a.niv3Code && a.niv3) services.set(`3:${a.niv3Code}`, { niveau: 3, code: a.niv3Code, libelle: a.niv3 });
    if (a.niv4Code && a.niv4 && a.niv4 !== a.niv3) services.set(`4:${a.niv4Code}`, { niveau: 4, code: a.niv4Code, libelle: a.niv4, parent: a.niv3 ?? "" });
  }
  const directions = [...services.values()].filter((s) => s.niveau === 3).sort((x, y) => x.libelle.localeCompare(y.libelle));
  const poles = [...services.values()].filter((s) => s.niveau === 4);

  const FormObj = ({ s }: { s: { niveau: number; code: string; libelle: string } }) => {
    const o = objs.find((x) => x.niveau === s.niveau && x.code === s.code);
    return (
      <form action={enregistrerObjectifsService} className="space-y-2">
        <input type="hidden" name="campagneId" value={c.id} />
        <input type="hidden" name="niveau" value={s.niveau} />
        <input type="hidden" name="code" value={s.code} />
        <input type="hidden" name="libelle" value={s.libelle} />
        <textarea name="texte" rows={3} defaultValue={o?.texte ?? ""} className="champ" placeholder="Objectifs…" />
        <button className="btn-secondaire py-1 text-xs">Enregistrer</button>
        {o?.texte && <span className="ml-2 text-xs text-sjr-vert-fonce">✓ renseigné</span>}
      </form>
    );
  };

  return (
    <Coquille u={u}>
      <Link href="/admin/campagnes" className="text-sm text-gray-500 hover:underline">← Campagnes</Link>
      <h1 className="mb-4 mt-1 text-2xl font-bold">{c.titre}</h1>
      <form action={enregistrerCampagne} className="carte mb-6 grid gap-3 p-5 md:grid-cols-6">
        <input type="hidden" name="id" value={c.id} />
        <div><label className="etiquette">Année</label><input name="annee" type="number" defaultValue={c.annee} className="champ" /></div>
        <div className="md:col-span-2"><label className="etiquette">Titre</label><input name="titre" defaultValue={c.titre} className="champ" /></div>
        <div><label className="etiquette">Début</label><input name="dateDebut" type="date" defaultValue={c.dateDebut ?? ""} className="champ" /></div>
        <div><label className="etiquette">Date limite</label><input name="dateLimite" type="date" defaultValue={c.dateLimite ?? ""} className="champ" /></div>
        <div><label className="etiquette">Relance (jours)</label><input name="relanceJours" type="number" min={1} defaultValue={c.relanceJours} className="champ" /></div>
        <div className="md:col-span-5">
          <label className="etiquette">Objectifs généraux de la Ville (partie IV de tous les comptes rendus)</label>
          <textarea name="objectifsVille" rows={8} defaultValue={c.objectifsVille} className="champ" />
        </div>
        <div>
          <label className="etiquette">État</label>
          <select name="statut" defaultValue={c.statut} className="champ"><option value="ouverte">Ouverte</option><option value="close">Close</option></select>
          <p className="mt-1 text-xs text-gray-500">Une campagne close n'envoie plus de relances.</p>
        </div>
        <div className="md:col-span-6"><button className="btn-primaire">Enregistrer la campagne</button></div>
      </form>

      <h2 className="titre-section mb-1">Objectifs des directions et des pôles</h2>
      <p className="mb-4 text-sm text-gray-600">Saisis une fois ici, ils apparaissent automatiquement dans la partie IV du compte rendu de chaque agent concerné (direction + pôle).</p>
      {!directions.length && <p className="carte p-5 text-sm text-gray-500">Importez d'abord la base agents pour voir la liste des directions.</p>}
      <div className="space-y-4">
        {directions.map((d) => (
          <details key={d.code} className="carte p-5">
            <summary className="cursor-pointer font-bold">{d.libelle}</summary>
            <div className="mt-3 space-y-4">
              <div><div className="etiquette">Objectifs de la direction</div><FormObj s={d} /></div>
              {poles.filter((p) => p.parent === d.libelle).sort((x, y) => x.libelle.localeCompare(y.libelle)).map((p) => (
                <div key={p.code} className="border-l-4 border-sjr-vert-clair pl-4"><div className="etiquette">Pôle : {p.libelle}</div><FormObj s={p} /></div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </Coquille>
  );
}

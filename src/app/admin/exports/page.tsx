import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { lignesListe } from "@/lib/dossier";
import { Coquille } from "@/components/Entete";
import { SelecteurCampagne } from "@/components/SelecteurCampagne";

export const dynamic = "force-dynamic";

export default async function PageExports({ searchParams }: { searchParams: Promise<{ campagne?: string }> }) {
  const u = await exigerAdmin();
  const { toutes, choisie } = await campagneChoisie((await searchParams).campagne);
  if (!choisie) return <Coquille u={u}><p>Aucune campagne.</p></Coquille>;
  const lignes = await lignesListe(undefined, choisie.id);
  const directions = [...new Set(lignes.map((l) => l.niv3).filter(Boolean))].sort();
  const nbTermines = lignes.filter((l) => l.statut === "termine").length;
  const xl = (type: string, titre: string, desc: string) => (
    <a href={`/api/export/excel?campagne=${choisie.id}&type=${type}`} className="carte block p-4 transition hover:border-sjr-primaire">
      <div className="font-bold text-sjr-primaire-fonce">{titre} ↓</div>
      <div className="text-sm text-gray-600">{desc}</div>
    </a>
  );
  return (
    <Coquille u={u}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Exports – campagne {choisie.annee}</h1>
        <SelecteurCampagne campagnes={toutes} choisie={choisie} action="/admin/exports" />
      </div>

      <section className="carte mb-6 p-5">
        <h2 className="titre-section mb-1">Comptes rendus PDF (archive zip)</h2>
        <p className="mb-4 text-sm text-gray-600">
          {nbTermines} compte(s) rendu(s) terminé(s). L'archive est rangée comme le dossier du serveur :
          <code className="mx-1 rounded bg-gray-100 px-1">Ville ou CCAS / Statut / NOM Prénom - EP {choisie.annee}.pdf</code>
          → il suffit de copier son contenu dans <em>sjr / drh / communs / entretiens pro</em>.
        </p>
        <form action="/api/export/zip" className="grid gap-3 md:grid-cols-5">
          <input type="hidden" name="campagne" value={choisie.id} />
          <div className="md:col-span-2">
            <label className="etiquette">Direction</label>
            <select name="direction" className="champ"><option value="">Toutes</option>{directions.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
          <div>
            <label className="etiquette">Collectivité</label>
            <select name="collectivite" className="champ"><option value="">Ville + CCAS</option><option>Ville</option><option>CCAS</option></select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="tous" value="1" /> Inclure les CR non terminés (provisoires)</label>
          <div className="flex items-end"><button className="btn-primaire w-full">Télécharger le zip</button></div>
        </form>
        <p className="mt-2 text-xs text-gray-500">Pour toute la mairie (≈ 400 PDF) la génération peut prendre une à deux minutes ; en cas d'échec, exportez direction par direction.</p>
      </section>

      <h2 className="titre-section mb-3">Tableaux Excel</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {xl("suivi", "Suivi de campagne", "Un agent par ligne : étape, personne en attente, dates (entretien, visas, fin).")}
        {xl("formation", "Besoins de formation", "Toutes les demandes de formation de la campagne, pour construire le plan de formation.")}
        {xl("voeux", "Vœux, mobilité et carrière", "Souhaits d'évolution et de mobilité, éligibilités (échelon, grade, promotion interne).")}
        {xl("appreciations", "Appréciations", "Le niveau retenu pour chacun des 15 critères, par agent.")}
      </div>
    </Coquille>
  );
}

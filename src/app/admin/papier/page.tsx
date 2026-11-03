import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { dossiersPapier } from "@/lib/papier";
import { Coquille } from "@/components/Entete";
import { TablePapier } from "@/components/TablePapier";
import { joursDepuis } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function PagePapier({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  const u = await exigerAdmin();
  const sp = await searchParams;
  const { choisie } = await campagneChoisie();
  const tous = choisie ? await dossiersPapier(choisie.id) : [];
  const directions = [...new Set(tous.map((x) => x.a.niv3 ?? ""))].filter(Boolean).sort();
  const liste = tous.filter((x) => !sp.direction || x.a.niv3 === sp.direction).sort((x, y) => x.a.nom.localeCompare(y.a.nom));
  return (
    <Coquille u={u}>
      <h1 className="mb-1 text-2xl font-bold">Visas papier</h1>
      <p className="mb-4 max-w-3xl text-sm text-gray-600">
        Agents sans e-mail ou qui ne se sont jamais connectés, dont c'est le tour de viser. Imprimez leurs comptes rendus en une fois, faites-les signer, puis cochez ceux revenus signés et enregistrez les visas en un clic.
        Le circuit continue automatiquement. Pensez à classer les originaux signés.
      </p>
      <form className="mb-4 flex gap-2" action="/admin/papier">
        <select name="direction" defaultValue={sp.direction ?? ""} className="champ w-auto">
          <option value="">Toutes les directions</option>
          {directions.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn-secondaire">Filtrer</button>
      </form>
      <TablePapier
        lignes={liste.map(({ e, a, final }) => ({
          id: e.id,
          agent: `${a.nom} ${a.prenom}`,
          matricule: a.matricule,
          service: [a.niv3, a.niv4].filter(Boolean).join(" › "),
          visa: final ? "final" : "premier",
          jours: joursDepuis(e.derniereActionLe),
        }))}
      />
    </Coquille>
  );
}

import { exigerAdmin } from "@/lib/auth";
import { campagneChoisie } from "@/lib/campagne";
import { libelleEtape, lignesListe } from "@/lib/dossier";
import { Coquille } from "@/components/Entete";
import { TableDossiers } from "@/components/TableDossiers";
import { joursDepuis } from "@/components/Badges";

export const dynamic = "force-dynamic";

type SP = { campagne?: string; statut?: string; direction?: string; attente?: string; retard?: string; q?: string };

export default async function PageDossiers({ searchParams }: { searchParams: Promise<SP> }) {
  const u = await exigerAdmin();
  const sp = await searchParams;
  const { toutes, choisie } = await campagneChoisie(sp.campagne);
  const lignes = choisie ? await lignesListe(undefined, choisie.id) : [];
  const directions = [...new Set(lignes.map((l) => l.niv3).filter(Boolean))].sort();
  const seuil = choisie?.relanceJours ?? 5;
  const q = (sp.q ?? "").toLowerCase().trim();

  const filtrees = lignes
    .filter((l) => !sp.statut || l.statut === sp.statut)
    .filter((l) => !sp.direction || l.niv3 === sp.direction)
    .filter((l) => !sp.attente || String(l.acteurCourantId) === sp.attente)
    .filter((l) => !sp.retard || (l.statut !== "termine" && joursDepuis(l.derniereActionLe) >= seuil))
    .filter((l) => !q || `${l.agentNom} ${l.agentPrenom} ${l.matricule} ${l.redacteurNom} ${l.service}`.toLowerCase().includes(q))
    .sort((a, b) => a.agentNom.localeCompare(b.agentNom));

  return (
    <Coquille u={u}>
      <h1 className="mb-4 text-2xl font-bold">Tous les dossiers</h1>
      <form className="carte mb-4 grid gap-3 p-4 md:grid-cols-6" action="/admin/dossiers">
        <div>
          <label className="etiquette">Campagne</label>
          <select name="campagne" defaultValue={choisie?.id} className="champ">
            {toutes.map((c) => <option key={c.id} value={c.id}>{c.annee}</option>)}
          </select>
        </div>
        <div>
          <label className="etiquette">Étape</label>
          <select name="statut" defaultValue={sp.statut ?? ""} className="champ">
            <option value="">Toutes</option>
            <option value="redaction">En rédaction</option>
            <option value="circuit">En cours de visa</option>
            <option value="termine">Terminés</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="etiquette">Direction</label>
          <select name="direction" defaultValue={sp.direction ?? ""} className="champ">
            <option value="">Toutes</option>
            {directions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="etiquette">Recherche</label>
          <input name="q" defaultValue={sp.q ?? ""} className="champ" placeholder="Nom, matricule…" />
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="retard" value="1" defaultChecked={!!sp.retard} /> En retard</label>
          <button className="btn-primaire">Filtrer</button>
        </div>
        {sp.attente && <input type="hidden" name="attente" value={sp.attente} />}
      </form>
      <div className="carte overflow-hidden">
        <TableDossiers
          seuil={seuil}
          lignes={filtrees.map((l) => ({
            id: l.id,
            agent: `${l.agentNom} ${l.agentPrenom}`,
            matricule: l.matricule,
            service: l.service,
            direction: l.niv3,
            etape: libelleEtape(l),
            statut: l.statut,
            attente: l.acteurCourantNom,
            jours: joursDepuis(l.derniereActionLe),
            progression: `étape ${Math.min(l.etapeIndex + 1, l.nbEtapes)} / ${l.nbEtapes}`,
          }))}
        />
      </div>
    </Coquille>
  );
}

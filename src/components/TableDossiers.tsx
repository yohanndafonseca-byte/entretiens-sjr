"use client";

import Link from "next/link";
import { useState } from "react";
import { relancerSelection } from "@/app/admin/actions";

export type LigneVue = {
  id: number;
  agent: string;
  matricule: string;
  service: string;
  direction: string;
  etape: string;
  statut: string;
  attente: string;
  jours: number;
  progression: string;
};

export function TableDossiers({ lignes, seuil }: { lignes: LigneVue[]; seuil: number }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [enCours, setEnCours] = useState(false);
  const actifs = lignes.filter((l) => l.statut !== "termine");
  const tout = actifs.length > 0 && actifs.every((l) => sel.has(l.id));

  function basculer(id: number) {
    const s = new Set(sel);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSel(s);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
        <span className="text-sm text-gray-600">{lignes.length} dossier(s) · {sel.size} sélectionné(s)</span>
        <button
          className="btn-primaire py-1.5"
          disabled={!sel.size || enCours}
          onClick={async () => {
            setEnCours(true);
            const r = await relancerSelection([...sel]);
            setMsg(r.message);
            setSel(new Set());
            setEnCours(false);
          }}
        >
          Relancer la sélection
        </button>
        {msg && <span className="text-sm text-sjr-primaire-fonce">{msg}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" aria-label="Tout sélectionner" checked={tout} onChange={() => setSel(tout ? new Set() : new Set(actifs.map((l) => l.id)))} />
              </th>
              <th>Agent</th>
              <th>Service</th>
              <th>Étape</th>
              <th>En attente de</th>
              <th className="text-right">Sans action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td>{l.statut !== "termine" && <input type="checkbox" aria-label={`Sélectionner ${l.agent}`} checked={sel.has(l.id)} onChange={() => basculer(l.id)} />}</td>
                <td>
                  <div className="font-medium">{l.agent}</div>
                  <div className="text-xs text-gray-400">{l.matricule}</div>
                </td>
                <td className="text-xs text-gray-600">{l.direction}<br />{l.service}</td>
                <td className="text-xs">{l.etape}<div className="text-gray-400">{l.progression}</div></td>
                <td className="text-xs">{l.attente}</td>
                <td className={`text-right text-xs ${l.statut !== "termine" && l.jours >= seuil ? "font-bold text-red-700" : "text-gray-500"}`}>
                  {l.statut === "termine" ? "—" : `${l.jours} j`}
                </td>
                <td className="text-right whitespace-nowrap">
                  <Link href={`/entretiens/${l.id}`} className="btn-secondaire py-1 text-xs">Ouvrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

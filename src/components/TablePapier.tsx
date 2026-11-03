"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { visasPapierEnLot } from "@/app/admin/actions";

export type LignePapier = { id: number; agent: string; matricule: string; service: string; visa: "premier" | "final"; jours: number };

export function TablePapier({ lignes }: { lignes: LignePapier[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const tout = lignes.length > 0 && lignes.every((l) => sel.has(l.id));
  const ids = [...sel];

  return (
    <div className="carte overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-sjr-ligne bg-gray-50 px-4 py-3 text-sm">
        <span>{sel.size} sélectionné(s)</span>
        <a
          className={`btn-secondaire py-1.5 ${sel.size ? "" : "pointer-events-none opacity-50"}`}
          href={`/api/export/papier?ids=${ids.join(",")}`}
          target="_blank"
          rel="noreferrer"
        >
          🖨 Imprimer la sélection (un seul PDF)
        </a>
        <span className="flex-1" />
        <label className="text-gray-600">Visas signés reçus le</label>
        <input type="date" className="champ w-auto py-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          className="btn-primaire py-1.5"
          disabled={!sel.size}
          onClick={async () => {
            if (!confirm(`Enregistrer ${sel.size} visa(s) papier datés du ${date.split("-").reverse().join("/")} ?`)) return;
            const r = await visasPapierEnLot(ids, date);
            setMsg(r.message);
            setSel(new Set());
            router.refresh();
          }}
        >
          ✓ Enregistrer les visas reçus
        </button>
      </div>
      {msg && <p className="bg-sjr-primaire-doux px-4 py-2 text-sm text-sjr-primaire-fonce">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="tableau">
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" aria-label="Tout sélectionner" checked={tout} onChange={() => setSel(tout ? new Set() : new Set(lignes.map((l) => l.id)))} /></th>
              <th>Agent</th><th>Service</th><th>Visa attendu</th><th className="text-right">En attente depuis</th><th></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td><input type="checkbox" aria-label={`Sélectionner ${l.agent}`} checked={sel.has(l.id)} onChange={() => { const s = new Set(sel); if (s.has(l.id)) s.delete(l.id); else s.add(l.id); setSel(s); }} /></td>
                <td><div className="font-medium">{l.agent}</div><div className="text-xs text-gray-400">{l.matricule}</div></td>
                <td className="text-xs text-gray-600">{l.service}</td>
                <td>{l.visa === "final" ? <span className="badge bg-sjr-attente-doux text-yellow-900">Visa final (notification)</span> : <span className="badge bg-gray-100 text-gray-700">1er visa (prise de connaissance)</span>}</td>
                <td className="text-right text-xs">{l.jours} j</td>
                <td className="text-right"><a href={`/entretiens/${l.id}`} className="btn-secondaire py-1 text-xs">Ouvrir</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lignes.length && <p className="p-6 text-sm text-gray-500">Aucun agent sans accès n'attend de visa en ce moment. 👍</p>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { viserEnSerie } from "@/app/entretiens/[id]/actions";

export type CarteVisa = {
  id: number;
  agent: string;
  service: string;
  redacteur: string;
  dateEntretien: string | null;
  nonSatisfaites: string[];
  aAmeliorer: number;
  satisfaites: number;
  appreciation: string;
  observations: { qui: string; texte: string }[];
  objectifs: number;
  jours: number;
};

export function FileVisas({ cartes }: { cartes: CarteVisa[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [lu, setLu] = useState(false);
  const [msg, setMsg] = useState("");
  const [enCours, setEnCours] = useState(false);
  const tout = cartes.length > 0 && cartes.every((c) => sel.has(c.id));

  return (
    <div className="space-y-4">
      <div className="carte sticky top-2 z-10 flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tout} onChange={() => setSel(tout ? new Set() : new Set(cartes.map((c) => c.id)))} /> Tout sélectionner
        </label>
        <span className="text-sm text-gray-500">{sel.size} / {cartes.length}</span>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} />
          J'ai pris connaissance des comptes rendus sélectionnés
        </label>
        <button
          className="btn-primaire"
          disabled={!sel.size || !lu || enCours}
          onClick={async () => {
            setEnCours(true);
            const r = await viserEnSerie([...sel]);
            setMsg(r.ok ? r.message ?? "" : r.erreur);
            setSel(new Set());
            setLu(false);
            setEnCours(false);
            router.refresh();
          }}
        >
          Viser la sélection ({sel.size})
        </button>
      </div>
      {msg && <p className="rounded-lg bg-sjr-primaire-doux p-3 text-sm text-sjr-primaire-fonce">✓ {msg}</p>}
      {cartes.map((c) => (
        <div key={c.id} className={`carte p-4 transition ${sel.has(c.id) ? "ring-2 ring-sjr-primaire" : ""}`}>
          <div className="flex flex-wrap items-start gap-3">
            <input
              type="checkbox"
              className="mt-1.5 h-4 w-4"
              aria-label={`Sélectionner ${c.agent}`}
              checked={sel.has(c.id)}
              onChange={() => {
                const s = new Set(sel);
                if (s.has(c.id)) s.delete(c.id);
                else s.add(c.id);
                setSel(s);
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-bold">{c.agent}</h3>
                <span className="text-xs text-gray-500">{c.service}</span>
                <span className="text-xs text-gray-400">· rédigé par {c.redacteur}{c.dateEntretien ? ` · entretien du ${c.dateEntretien}` : ""} · en attente depuis {c.jours} j</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="badge bg-sjr-primaire-doux text-sjr-primaire-fonce">{c.satisfaites} satisfaites</span>
                <span className={`badge ${c.aAmeliorer ? "bg-sjr-attente-doux text-yellow-900" : "bg-gray-100 text-gray-500"}`}>{c.aAmeliorer} à améliorer</span>
                <span className={`badge ${c.nonSatisfaites.length ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-500"}`}>{c.nonSatisfaites.length} non satisfaite(s)</span>
                <span className="badge bg-gray-100 text-gray-600">{c.objectifs} objectif(s) fixé(s)</span>
              </div>
              {c.nonSatisfaites.length > 0 && <p className="mt-2 text-xs text-red-700">Non satisfaites : {c.nonSatisfaites.join(" ; ")}</p>}
              <p className="mt-2 line-clamp-3 text-sm text-gray-700">« {c.appreciation} »</p>
              {c.observations.map((o, i) => (
                <p key={i} className="mt-1 text-xs italic text-gray-600">Observation de {o.qui} : « {o.texte} »</p>
              ))}
            </div>
            <a href={`/entretiens/${c.id}`} className="btn-secondaire py-1.5 text-xs">Lire en entier / ajouter une observation</a>
          </div>
        </div>
      ))}
      {!cartes.length && <div className="carte p-8 text-center text-gray-500">Aucun visa en attente. 👍</div>}
    </div>
  );
}

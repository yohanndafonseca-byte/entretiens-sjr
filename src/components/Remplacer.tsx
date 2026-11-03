"use client";

import { useState } from "react";
import { remplacerPartout } from "@/app/admin/actions";

type P = { id: number; libelle: string };

function Choix({ personnes, onChange, id, placeholder }: { personnes: P[]; onChange: (v: number | null) => void; id: string; placeholder: string }) {
  return (
    <>
      <input className="champ" list={id} placeholder={placeholder} onChange={(e) => onChange(personnes.find((p) => p.libelle === e.target.value)?.id ?? null)} />
      <datalist id={id}>{personnes.map((p) => <option key={p.id} value={p.libelle} />)}</datalist>
    </>
  );
}

export function Remplacer({ personnes }: { personnes: P[] }) {
  const [ancien, setAncien] = useState<number | null>(null);
  const [nouveau, setNouveau] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="carte max-w-3xl space-y-4 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="etiquette">Personne qui part / est absente</label><Choix id="l-ancien" personnes={personnes} onChange={setAncien} placeholder="Nom ou matricule…" /></div>
        <div><label className="etiquette">Remplacée par</label><Choix id="l-nouveau" personnes={personnes} onChange={setNouveau} placeholder="Nom ou matricule…" /></div>
      </div>
      <ul className="ml-5 list-disc text-sm text-gray-600">
        <li>dans tous les dossiers en cours, pour les visas <strong>pas encore donnés</strong> (les visas déjà posés restent à son nom) ;</li>
        <li>comme rédacteur (N+1) des comptes rendus pas encore visés ;</li>
        <li>dans les circuits d'exception et comme « dernier visa » des campagnes ouvertes.</li>
      </ul>
      <p className="text-xs text-gray-500">Les personnes dont c'est le tour sont prévenues par e-mail. Pensez aussi à réimporter l'export agents pour que l'organigramme soit à jour l'an prochain.</p>
      <button
        className="btn-primaire"
        disabled={!ancien || !nouveau || enCours}
        onClick={async () => {
          if (!confirm("Confirmer le remplacement partout ?")) return;
          setEnCours(true);
          const r = await remplacerPartout(ancien!, nouveau!);
          setMsg({ ok: r.ok, texte: r.message });
          setEnCours(false);
        }}
      >
        Remplacer partout
      </button>
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-red-50 text-red-700"}`}>{msg.texte}</p>}
    </div>
  );
}

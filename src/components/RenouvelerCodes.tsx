"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionRegenererCodes } from "@/app/admin/actions";

export function RenouvelerCodes({ nb, directions, annee }: { nb: number; directions: string[]; annee: number | null }) {
  const router = useRouter();
  const [envoyer, setEnvoyer] = useState(true);
  const [direction, setDirection] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof actionRegenererCodes>> | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <section className="carte border-t-4 border-t-sjr-primaire p-5">
      <h2 className="titre-section mb-1">Renouveler les codes {annee ? `pour la campagne ${annee}` : ""}</h2>
      <p className="mb-4 text-sm text-gray-600">
        Un nouveau code pour chaque agent <strong>sans outil informatique</strong> ({nb} agent(s)). Les anciens codes et mots de passe de ces agents cessent aussitôt de fonctionner.
        Les agents qui ont un e-mail ne sont <strong>pas</strong> concernés : ils gardent leur mot de passe et peuvent le réinitialiser seuls (« Mot de passe oublié »).
      </p>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="etiquette">Direction</label>
          <select className="champ" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Toutes les directions</option>
            {directions.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} />
          <span>
            <strong>Envoyer à chaque responsable direct</strong> un PDF avec les fiches de code de son équipe, à imprimer et remettre en main propre.
            <span className="mt-1 block text-xs text-gray-500">Le responsable a alors connaissance des codes : le courriel lui demande de ne pas les conserver. Chaque visa reste tracé (date, poste, mode).</span>
          </span>
        </label>
      </div>
      <button
        className="btn-primaire"
        disabled={enCours || !nb}
        onClick={async () => {
          if (!confirm(`Générer de nouveaux codes pour ${direction ? `les agents sans outil de « ${direction} »` : `les ${nb} agents sans outil informatique`} ?\n\nLeurs anciens codes ne fonctionneront plus.`)) return;
          setEnCours(true);
          setRes(await actionRegenererCodes(envoyer, direction || null));
          setEnCours(false);
          router.refresh();
        }}
      >
        {enCours ? "Génération…" : "Générer les nouveaux codes"}
      </button>
      {res && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="rounded-lg bg-sjr-primaire-doux p-3 text-sjr-primaire-fonce">
            ✓ {res.regeneres} code(s) renouvelé(s){envoyer ? ` · fiches envoyées à ${res.responsablesPrevenus} responsable(s)` : ""}.
          </p>
          {res.sansResponsable.length > 0 && (
            <details open className="rounded-lg bg-sjr-attente-doux p-3 text-yellow-900">
              <summary className="cursor-pointer font-medium">{res.sansResponsable.length} agent(s) sans responsable joignable : imprimez leurs fiches ci-dessous</summary>
              <ul className="ml-5 mt-2 list-disc text-xs">{res.sansResponsable.map((x) => <li key={x}>{x}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

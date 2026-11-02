"use client";

import { useActionState } from "react";
import type { EtatImport } from "@/app/admin/actions";

export function FormImport({
  action,
  titre,
  description,
  campagneId,
  bouton,
}: {
  action: (e: EtatImport, fd: FormData) => Promise<EtatImport>;
  titre: string;
  description: React.ReactNode;
  campagneId?: number;
  bouton: string;
}) {
  const [etat, act, enCours] = useActionState(action, undefined);
  const r = etat?.rapport;
  return (
    <section className="carte p-5">
      <h2 className="titre-section mb-1">{titre}</h2>
      <div className="mb-4 text-sm text-gray-600">{description}</div>
      <form action={act} className="flex flex-wrap items-center gap-3">
        {campagneId && <input type="hidden" name="campagneId" value={campagneId} />}
        <input type="file" name="fichier" accept=".xlsx,.csv,.txt" required className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sjr-vert-clair file:px-3 file:py-2 file:text-sjr-vert-fonce" />
        <button className="btn-primaire" disabled={enCours}>{enCours ? "Import en cours…" : bouton}</button>
      </form>
      {etat?.erreur && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{etat.erreur}</p>}
      {r && (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-sjr-vert-clair text-sjr-vert-fonce">{r.crees} créé(s)</span>
            <span className="badge bg-gray-100 text-gray-700">{r.maj} mis à jour</span>
            {r.desactives > 0 && <span className="badge bg-gray-100 text-gray-700">{r.desactives} désactivé(s) (départ)</span>}
            {r.ignores > 0 && <span className="badge bg-gray-100 text-gray-700">{r.ignores} ignoré(s)</span>}
            {r.alertes.length > 0 && <span className="badge bg-sjr-jaune-clair text-yellow-800">{r.alertes.length} alerte(s)</span>}
            {r.erreurs.length > 0 && <span className="badge bg-red-50 text-red-700">{r.erreurs.length} erreur(s)</span>}
          </div>
          {r.erreurs.length > 0 && <ul className="ml-5 list-disc text-red-700">{r.erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {r.alertes.length > 0 && (
            <details open={r.alertes.length <= 10} className="rounded-lg bg-sjr-jaune-clair p-3">
              <summary className="cursor-pointer font-medium text-yellow-900">Points à vérifier</summary>
              <ul className="ml-5 mt-2 list-disc text-yellow-900">{r.alertes.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </details>
          )}
          {r.codes.length > 0 && (
            <p className="text-gray-600">
              {r.codes.length} nouveau(x) compte(s) avec code provisoire.{" "}
              <a href="/admin/agents/codes" className="font-medium text-sjr-vert-fonce hover:underline">Imprimer les codes →</a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

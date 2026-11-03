"use client";

import { startTransition, useActionState } from "react";
import type { EtatImport } from "@/app/admin/actions";

function Liste({ titre, items, ton }: { titre: string; items: string[]; ton: "vert" | "gris" | "orange" }) {
  if (!items.length) return null;
  const cls = ton === "vert" ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : ton === "orange" ? "bg-sjr-attente-doux text-yellow-900" : "bg-gray-50 text-gray-700";
  return (
    <details className={`rounded-lg p-3 ${cls}`} open={items.length <= 8}>
      <summary className="cursor-pointer font-medium">{titre} ({items.length})</summary>
      <ul className="ml-5 mt-2 list-disc space-y-0.5 text-xs">{items.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </details>
  );
}

export function FormImport({
  action,
  titre,
  description,
  campagneId,
  bouton,
  avecApercu = false,
}: {
  action: (e: EtatImport, fd: FormData) => Promise<EtatImport>;
  titre: string;
  description: React.ReactNode;
  campagneId?: number;
  bouton: string;
  avecApercu?: boolean;
}) {
  const [etat, act, enCours] = useActionState(action, undefined);
  const r = etat?.rapport;
  return (
    <section className="carte p-5">
      <h2 className="titre-section mb-1">{titre}</h2>
      <div className="mb-4 text-sm text-gray-600">{description}</div>
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          // envoi manuel : le fichier reste sélectionné entre l'aperçu et la validation
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => act(fd));
        }}
      >
        {campagneId && <input type="hidden" name="campagneId" value={campagneId} />}
        <input type="file" name="fichier" accept=".xlsx,.csv,.txt" required className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sjr-primaire-doux file:px-3 file:py-2 file:text-sjr-primaire-fonce" />
        {avecApercu ? (
          <>
            <button name="mode" value="apercu" className="btn-secondaire" disabled={enCours}>{enCours ? "Analyse…" : "1. Voir ce qui va changer"}</button>
            <button name="mode" value="valider" className="btn-primaire" disabled={enCours || !r?.simulation}>2. {bouton}</button>
          </>
        ) : (
          <button className="btn-primaire" disabled={enCours}>{enCours ? "Import en cours…" : bouton}</button>
        )}
      </form>
      {avecApercu && !r && <p className="mt-2 text-xs text-gray-500">Rien n'est modifié tant que vous n'avez pas validé l'étape 2.</p>}
      {etat?.erreur && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{etat.erreur}</p>}
      {r && (
        <div className="mt-4 space-y-3 text-sm">
          <p className={`rounded-lg p-2 font-medium ${r.simulation ? "bg-sjr-attente-doux text-yellow-900" : "bg-sjr-primaire-doux text-sjr-primaire-fonce"}`}>
            {r.simulation ? "Aperçu : rien n'a encore été enregistré. Vérifiez puis cliquez sur « 2. " + bouton + " »." : "✓ Import terminé."}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-sjr-primaire-doux text-sjr-primaire-fonce">{r.crees} nouveau(x)</span>
            {r.details && <span className="badge bg-gray-100 text-gray-700">{r.details.changements.length} modifié(s)</span>}
            {r.details && <span className="badge bg-gray-100 text-gray-700">{r.inchanges} inchangé(s)</span>}
            {!r.details && <span className="badge bg-gray-100 text-gray-700">{r.maj} mis à jour</span>}
            {r.desactives > 0 && <span className="badge bg-gray-100 text-gray-700">{r.desactives} départ(s)</span>}
            {r.ignores > 0 && <span className="badge bg-gray-100 text-gray-700">{r.ignores} ignoré(s)</span>}
            {r.details?.sansEmail ? <span className="badge bg-sjr-attente-doux text-yellow-800">{r.details.sansEmail} sans e-mail</span> : null}
            {r.alertes.length > 0 && <span className="badge bg-sjr-attente-doux text-yellow-800">{r.alertes.length} alerte(s)</span>}
            {r.erreurs.length > 0 && <span className="badge bg-red-50 text-red-700">{r.erreurs.length} erreur(s)</span>}
          </div>
          {r.erreurs.length > 0 && <ul className="ml-5 list-disc text-red-700">{r.erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {r.details && (
            <>
              <Liste titre="Nouveaux agents" items={r.details.nouveaux} ton="vert" />
              <Liste titre="Départs (seront désactivés)" items={r.details.departs} ton="orange" />
              <Liste titre="Changements (service, grade, poste, e-mail…)" items={r.details.changements} ton="gris" />
            </>
          )}
          <Liste titre="Points à vérifier" items={r.alertes} ton="orange" />
          {!r.simulation && r.codes.length > 0 && (
            <p className="text-gray-600">
              {r.codes.length} nouveau(x) compte(s) avec code provisoire.{" "}
              <a href="/admin/agents/codes" className="font-medium text-sjr-primaire-fonce hover:underline">Imprimer les codes →</a>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { actionGenererDossiers } from "@/app/admin/actions";
import type { LigneCircuit } from "@/lib/circuits";

const SOURCE: Record<string, string> = { exception: "Exception RH", reconduit: "Comme l'an dernier", organigramme: "Organigramme" };
const RES: Record<string, { l: string; c: string }> = {
  cree: { l: "Nouveau dossier", c: "bg-sjr-primaire-doux text-sjr-primaire-fonce" },
  maj: { l: "Circuit modifié", c: "bg-sjr-attente-doux text-yellow-900" },
  inchange: { l: "Inchangé", c: "bg-gray-100 text-gray-600" },
  verrouille: { l: "Déjà en visa", c: "bg-gray-100 text-gray-600" },
  ignore: { l: "Non créé", c: "bg-red-50 text-red-700" },
};

export function GenerateurDossiers({ campagneId, annee, aUnePrecedente, viseurFinal }: { campagneId: number; annee: number; aUnePrecedente: boolean; viseurFinal: string | null }) {
  const [reconduire, setReconduire] = useState(aUnePrecedente);
  const [lignes, setLignes] = useState<LigneCircuit[] | null>(null);
  const [simulation, setSimulation] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [filtre, setFiltre] = useState<"alertes" | "tout" | "changements">("changements");

  async function lancer(sim: boolean) {
    if (!sim && !confirm("Créer / mettre à jour les dossiers de la campagne avec ces circuits ?")) return;
    setEnCours(true);
    setLignes(await actionGenererDossiers(campagneId, reconduire, sim));
    setSimulation(sim);
    setEnCours(false);
  }

  const n = (r: string) => lignes?.filter((l) => l.resultat === r).length ?? 0;
  const vues = (lignes ?? []).filter((l) =>
    filtre === "tout" ? true : filtre === "alertes" ? l.alertes.length > 0 : l.resultat === "cree" || l.resultat === "maj" || l.resultat === "ignore" || l.alertes.length > 0,
  );

  return (
    <section className="carte p-5">
      <h2 className="titre-section mb-1">② Créer les dossiers {annee} et leurs circuits de visa</h2>
      <div className="mb-4 space-y-1 text-sm text-gray-600">
        <p>L'application calcule le circuit de chaque agent, <strong>sans fichier à préparer</strong> :</p>
        <ol className="ml-5 list-decimal text-xs">
          <li><strong>Exception</strong> : le circuit fixé à la main sur la fiche de l'agent (toujours prioritaire, gardé d'une année sur l'autre) ;</li>
          <li><strong>Comme l'an dernier</strong> (si coché) : repris tel quel si toutes les personnes sont toujours en poste ;</li>
          <li><strong>Organigramme</strong> : responsables des niveaux 6 → 3 de l'export agents, puis le dernier visa de la campagne ({viseurFinal ?? <em>non défini – à choisir dans la campagne</em>}).</li>
        </ol>
        <p className="text-xs">Les dossiers déjà en cours de visa ne sont jamais modifiés. Les agents marqués « non concernés » sont ignorés.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={reconduire} onChange={(e) => setReconduire(e.target.checked)} disabled={!aUnePrecedente} />
          Reprendre les circuits de l'an dernier quand c'est possible
        </label>
        <button className="btn-secondaire" disabled={enCours} onClick={() => lancer(true)}>{enCours && simulation ? "Calcul…" : "1. Voir les circuits proposés"}</button>
        <button className="btn-primaire" disabled={enCours || !lignes || !simulation} onClick={() => lancer(false)}>2. Créer les dossiers</button>
      </div>
      {lignes && (
        <div className="mt-4 space-y-3">
          <p className={`rounded-lg p-2 text-sm font-medium ${simulation ? "bg-sjr-attente-doux text-yellow-900" : "bg-sjr-primaire-doux text-sjr-primaire-fonce"}`}>
            {simulation ? "Aperçu : rien n'est encore créé." : "✓ Dossiers créés. Les circuits restent modifiables un par un dans « Agents & circuits »."}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(["cree", "maj", "inchange", "verrouille", "ignore"] as const).map((r) => (
              <span key={r} className={`badge ${RES[r].c}`}>{n(r)} {RES[r].l.toLowerCase()}</span>
            ))}
            <span className="badge bg-sjr-attente-doux text-yellow-800">{lignes.filter((l) => l.alertes.length).length} à vérifier</span>
            <span className="flex-1" />
            <select className="champ w-auto py-1 text-xs" value={filtre} onChange={(e) => setFiltre(e.target.value as typeof filtre)}>
              <option value="changements">Nouveaux, modifiés et alertes</option>
              <option value="alertes">Seulement les alertes</option>
              <option value="tout">Tous les agents</option>
            </select>
          </div>
          <div className="max-h-[480px] overflow-auto rounded-lg border border-sjr-ligne">
            <table className="tableau">
              <thead className="sticky top-0"><tr><th>Agent</th><th>Circuit proposé (après l'agent)</th><th>Origine</th><th>Résultat</th></tr></thead>
              <tbody>
                {vues.map((l) => (
                  <tr key={l.agentId}>
                    <td>
                      <a className="font-medium hover:underline" href={`/admin/agents/${l.agentId}`} target="_blank" rel="noreferrer">{l.agent}</a>
                      <div className="text-xs text-gray-500">{l.service}</div>
                    </td>
                    <td className="text-xs">
                      {l.circuit.length ? l.circuit.join(" → ") + " → visa final de l'agent" : "—"}
                      {l.alertes.map((a, i) => <div key={i} className="mt-1 text-yellow-800">⚠ {a}</div>)}
                    </td>
                    <td className="text-xs">{l.source ? SOURCE[l.source] : "—"}</td>
                    <td><span className={`badge ${RES[l.resultat].c}`}>{RES[l.resultat].l}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!vues.length && <p className="p-4 text-sm text-gray-500">Rien à signaler.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

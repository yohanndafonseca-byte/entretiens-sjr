"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  enregistrerRecours,
  enregistrerVisaPapier,
  relancerMaintenant,
  retirerDuCircuit,
  renvoyerEnRedaction,
  rouvrir,
  viser,
  viserEnPresence,
} from "@/app/entretiens/[id]/actions";
import type { Droits } from "@/lib/dossier";

type EtapeVue = { ordre: number; nom: string; estAgent: boolean; viseLe: string | null; observations: string | null; modeVisa: string | null; courante: boolean };
type Recours = { dateDemande: string; dateReponse: string; decision: string; saisineCapLe: string; avisCap: string; commentaire: string };

type Props = {
  id: number;
  statut: string;
  droits: Droits;
  redacteur: string;
  visaRedacteurLe: string | null;
  etapes: EtapeVue[];
  agentNom: string;
  historique: { at: string; qui: string; action: string; details: string | null }[];
  recours: Recours | null;
  derniereEtapeAgent: boolean;
};

function Message({ m }: { m: { ok: boolean; texte: string } | null }) {
  if (!m) return null;
  return <p className={`whitespace-pre-line rounded-lg p-2 text-sm ${m.ok ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-red-50 text-red-700"}`}>{m.texte}</p>;
}

export function PanneauCircuit(p: Props) {
  const router = useRouter();
  const [obs, setObs] = useState("");
  const [lu, setLu] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [presence, setPresence] = useState(false);
  const [codeAgent, setCodeAgent] = useState("");
  const [papier, setPapier] = useState(false);
  const [datePapier, setDatePapier] = useState(new Date().toISOString().slice(0, 10));
  const [renvoi, setRenvoi] = useState(false);
  const [motif, setMotif] = useState("");
  const [rec, setRec] = useState<Recours>(p.recours ?? { dateDemande: "", dateReponse: "", decision: "en_cours", saisineCapLe: "", avisCap: "", commentaire: "" });

  async function executer(f: () => Promise<{ ok: true; message?: string } | { ok: false; erreur: string }>) {
    setEnCours(true);
    setMsg(null);
    try {
      const r = await f();
      setMsg(r.ok ? { ok: true, texte: r.message ?? "Fait." } : { ok: false, texte: r.erreur });
      if (r.ok) {
        setObs("");
        setCodeAgent("");
        setPresence(false);
        setPapier(false);
        setRenvoi(false);
        setMotif("");
        setLu(false);
        router.refresh();
      }
    } finally {
      setEnCours(false);
    }
  }

  const fr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");
  const courante = p.etapes.find((e) => e.courante);

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
      <div className="carte p-4">
        <h2 className="mb-3 font-bold">Circuit de visas</h2>
        <ol className="relative space-y-3 border-l-2 border-gray-200 pl-4 text-sm">
          <li className="relative">
            <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ${p.visaRedacteurLe ? "bg-sjr-primaire" : p.statut === "redaction" ? "bg-sjr-attente ring-2 ring-yellow-400" : "bg-gray-300"}`} />
            <div className="font-medium">{p.redacteur}</div>
            <div className="text-xs text-gray-500">Rédaction et visa du N+1 {p.visaRedacteurLe ? `· visé le ${fr(p.visaRedacteurLe)}` : p.statut === "redaction" ? "· en cours" : ""}</div>
          </li>
          {p.etapes.map((e, i) => (
            <li key={e.ordre} className="relative">
              <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ${e.viseLe ? "bg-sjr-primaire" : e.courante ? "bg-sjr-attente ring-2 ring-yellow-400" : "bg-gray-300"}`} />
              <div className="font-medium">
                {e.nom}
                {e.estAgent && <span className="badge ml-1 bg-gray-100 text-gray-600">{i === p.etapes.length - 1 ? "agent – visa final" : "agent"}</span>}
              </div>
              <div className="text-xs text-gray-500">
                {e.viseLe
                  ? `Visé le ${fr(e.viseLe)}${e.modeVisa === "papier" ? " (papier)" : e.modeVisa === "en_presence" ? " (en présence)" : ""}`
                  : e.courante
                    ? "En attente de visa"
                    : "À venir"}
              </div>
              {e.observations && <div className="mt-1 rounded bg-gray-50 p-2 text-xs italic text-gray-700">« {e.observations} »</div>}
            </li>
          ))}
        </ol>
        {p.statut === "termine" && <p className="mt-3 rounded-lg bg-sjr-primaire-doux p-2 text-sm font-medium text-sjr-primaire-fonce">✓ Compte rendu définitif</p>}
      </div>

      <Message m={msg} />

      {p.droits.viser && courante && (
        <div className="carte border-t-4 border-t-sjr-attente p-4">
          <h2 className="mb-2 font-bold">{p.droits.estAgent ? (p.derniereEtapeAgent ? "Visa final" : "Votre visa") : "Votre visa"}</h2>
          <p className="mb-3 text-xs text-gray-600">
            {p.droits.estAgent
              ? p.derniereEtapeAgent
                ? "Votre ligne hiérarchique a visé le compte rendu. Ce dernier visa vaut notification : les délais de recours courent à partir d'aujourd'hui."
                : "Votre visa atteste que vous avez pris connaissance du compte rendu ; il ne vaut pas accord. Vous pouvez formuler des observations."
              : "Vous pouvez ajouter des observations. Pour demander une modification du contenu, utilisez « Renvoyer en rédaction »."}
          </p>
          <label className="etiquette">Observations éventuelles</label>
          <textarea className="champ mb-3" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          <label className="mb-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={lu} onChange={(e) => setLu(e.target.checked)} />
            <span>J'ai pris connaissance du compte rendu{p.droits.estAgent ? " et des voies de recours" : ""}.</span>
          </label>
          <button className="btn-primaire w-full" disabled={!lu || enCours} onClick={() => executer(() => viser(p.id, obs))}>
            Viser
          </button>
        </div>
      )}

      {p.droits.recueillirVisaPresence && (
        <div className="carte p-4">
          <h2 className="mb-1 font-bold">Visa de l'agent en attente</h2>
          <p className="mb-3 text-xs text-gray-600">Si {p.agentNom} est à côté de vous, il/elle peut viser directement sur ce poste avec son code personnel.</p>
          {!presence ? (
            <button className="btn-secondaire w-full" onClick={() => setPresence(true)}>Faire viser l'agent sur ce poste</button>
          ) : (
            <div className="space-y-2 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-medium">À remplir par l'agent :</p>
              <textarea className="champ" rows={2} placeholder="Observations éventuelles de l'agent" value={obs} onChange={(e) => setObs(e.target.value)} />
              <input className="champ" type="password" placeholder="Code personnel de l'agent" value={codeAgent} onChange={(e) => setCodeAgent(e.target.value)} autoComplete="off" />
              <div className="flex gap-2">
                <button className="btn-primaire flex-1" disabled={!codeAgent || enCours} onClick={() => executer(() => viserEnPresence(p.id, codeAgent, obs))}>Viser</button>
                <button className="btn-secondaire" onClick={() => setPresence(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {p.droits.admin && courante && (
        <div className="carte p-4">
          <h2 className="mb-2 font-bold">Actions RH</h2>
          <div className="flex flex-col gap-2">
            <button className="btn-secondaire" disabled={enCours} onClick={() => executer(() => relancerMaintenant(p.id))}>Relancer {courante.nom}</button>
            {!papier ? (
              <button className="btn-secondaire" onClick={() => setPapier(true)}>Enregistrer un visa papier de {courante.nom}</button>
            ) : (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                <label className="etiquette">Date du visa (signature papier)</label>
                <input type="date" className="champ" value={datePapier} onChange={(e) => setDatePapier(e.target.value)} />
                <textarea className="champ" rows={2} placeholder="Observations portées sur le papier" value={obs} onChange={(e) => setObs(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primaire flex-1" disabled={enCours} onClick={() => executer(() => enregistrerVisaPapier(p.id, datePapier, obs))}>Enregistrer</button>
                  <button className="btn-secondaire" onClick={() => setPapier(false)}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {p.droits.admin && p.statut === "redaction" && (
        <div className="carte p-4">
          <h2 className="mb-1 font-bold">Actions RH</h2>
          <p className="mb-2 text-xs text-gray-600">Agent non concerné cette année (départ, longue absence, saisonnier…) ?</p>
          <button
            className="btn-danger w-full"
            disabled={enCours}
            onClick={async () => {
              if (!confirm("Retirer ce dossier de la campagne ? Le brouillon éventuel sera supprimé.")) return;
              const r = await retirerDuCircuit(p.id);
              if (r.ok) router.push("/admin/dossiers");
              else setMsg({ ok: false, texte: r.erreur });
            }}
          >
            Retirer de la campagne
          </button>
        </div>
      )}

      {p.droits.renvoyer && (
        <div className="carte p-4">
          {!renvoi ? (
            <button className="btn-danger w-full" onClick={() => setRenvoi(true)}>Renvoyer en rédaction</button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Le compte rendu retourne au N+1 pour modification. <strong>Tous les visas déjà posés seront annulés</strong> et le circuit reprendra depuis le début.</p>
              <textarea className="champ" rows={2} placeholder="Motif (obligatoire)" value={motif} onChange={(e) => setMotif(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-danger flex-1" disabled={!motif.trim() || enCours} onClick={() => executer(() => renvoyerEnRedaction(p.id, motif))}>Confirmer le renvoi</button>
                <button className="btn-secondaire" onClick={() => setRenvoi(false)}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}

      {p.droits.admin && p.statut === "termine" && (
        <details className="carte p-4">
          <summary className="cursor-pointer font-bold">Demande de révision / recours</summary>
          <div className="mt-3 grid gap-2 text-sm">
            <label className="etiquette">Demande de révision reçue le</label>
            <input type="date" className="champ" value={rec.dateDemande} onChange={(e) => setRec({ ...rec, dateDemande: e.target.value })} />
            <label className="etiquette">Réponse de l'autorité territoriale le</label>
            <input type="date" className="champ" value={rec.dateReponse} onChange={(e) => setRec({ ...rec, dateReponse: e.target.value })} />
            <label className="etiquette">Décision</label>
            <select className="champ" value={rec.decision} onChange={(e) => setRec({ ...rec, decision: e.target.value })}>
              <option value="en_cours">En cours d'instruction</option>
              <option value="rejet">Rejet (explicite ou implicite)</option>
              <option value="revision_partielle">Révision partielle</option>
              <option value="revision_acceptee">Révision acceptée</option>
            </select>
            <label className="etiquette">Saisine de la CAP le</label>
            <input type="date" className="champ" value={rec.saisineCapLe} onChange={(e) => setRec({ ...rec, saisineCapLe: e.target.value })} />
            <label className="etiquette">Avis de la CAP</label>
            <input className="champ" value={rec.avisCap} onChange={(e) => setRec({ ...rec, avisCap: e.target.value })} />
            <label className="etiquette">Commentaire</label>
            <textarea className="champ" rows={2} value={rec.commentaire} onChange={(e) => setRec({ ...rec, commentaire: e.target.value })} />
            <button className="btn-primaire" disabled={enCours} onClick={() => executer(() => enregistrerRecours(p.id, rec))}>Enregistrer</button>
            <hr className="my-2" />
            <p className="text-xs text-gray-600">Si la révision est acceptée, rouvrez le dossier pour que le N+1 corrige le compte rendu ; il repartira dans le circuit.</p>
            <input className="champ" placeholder="Motif de réouverture" value={motif} onChange={(e) => setMotif(e.target.value)} />
            <button className="btn-danger" disabled={!motif.trim() || enCours} onClick={() => executer(() => rouvrir(p.id, motif))}>Rouvrir le dossier</button>
          </div>
        </details>
      )}

      <details className="carte p-4">
        <summary className="cursor-pointer font-bold">Historique ({p.historique.length})</summary>
        <ul className="mt-3 space-y-2 text-xs">
          {p.historique.map((h, i) => (
            <li key={i} className="border-l-2 border-gray-200 pl-2">
              <div className="text-gray-400">{new Date(h.at).toLocaleString("fr-FR")}</div>
              <div><span className="font-medium">{h.action}</span>{h.qui ? ` — ${h.qui}` : ""}</div>
              {h.details && <div className="text-gray-600">{h.details}</div>}
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

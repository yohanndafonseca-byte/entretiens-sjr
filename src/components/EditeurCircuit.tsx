"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changerRedacteur, enregistrerCircuit, reinitialiserCode, remplacerActeurEtape } from "@/app/admin/actions";

type Personne = { id: number; libelle: string };
type EtapeVue = { id: number; ordre: number; acteurId: number; vise: boolean };

function ChoixPersonne({ personnes, valeur, onChange, id }: { personnes: Personne[]; valeur: number | null; onChange: (id: number | null) => void; id: string }) {
  const courant = personnes.find((p) => p.id === valeur);
  const [texte, setTexte] = useState(courant?.libelle ?? "");
  return (
    <>
      <input
        className="champ"
        list={`liste-${id}`}
        value={texte}
        placeholder="Tapez un nom ou un matricule…"
        onChange={(e) => {
          setTexte(e.target.value);
          const p = personnes.find((x) => x.libelle === e.target.value);
          onChange(p ? p.id : null);
        }}
      />
      <datalist id={`liste-${id}`}>{personnes.map((p) => <option key={p.id} value={p.libelle} />)}</datalist>
    </>
  );
}

export function EditeurCircuit({
  campagneId,
  annee,
  agent,
  personnes,
  statut,
  entretienId,
  redacteurId,
  etapes,
}: {
  campagneId: number;
  annee: number;
  agent: Personne;
  personnes: Personne[];
  statut: string | null;
  entretienId: number | null;
  redacteurId: number | null;
  etapes: EtapeVue[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const initial = etapes.length ? etapes.map((e) => e.acteurId) : [agent.id, 0, agent.id];
  const [acteurs, setActeurs] = useState<(number | null)[]>(initial);
  const [cle, setCle] = useState(0);
  const libre = !statut || statut === "redaction";

  async function sauver() {
    if (acteurs.some((a) => !a)) return setMsg({ ok: false, texte: "Une ligne du circuit est vide ou ne correspond à aucune personne." });
    const r = await enregistrerCircuit(campagneId, agent.id, acteurs as number[]);
    setMsg({ ok: r.ok, texte: r.message });
    if (r.ok) router.refresh();
  }

  const deplacer = (i: number, d: number) => {
    const t = [...acteurs];
    [t[i], t[i + d]] = [t[i + d], t[i]];
    setActeurs(t);
    setCle((k) => k + 1);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Ordre de visa pour la campagne {annee}. Après la rédaction par le N+1 (la 1re personne après l'agent), chacun vise dans cet ordre.
        {statut === "circuit" && " Le dossier est en cours de visa : seules les personnes qui n'ont pas encore visé peuvent être remplacées."}
        {statut === "termine" && " Le dossier est terminé."}
      </p>
      {libre ? (
        <>
          <ol className="space-y-2" key={cle}>
            {acteurs.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-gray-400">{i + 1}.</span>
                <div className="flex-1">
                  <ChoixPersonne id={`a${i}-${cle}`} personnes={personnes} valeur={a} onChange={(v) => setActeurs((t) => t.map((x, j) => (j === i ? v : x)))} />
                </div>
                <span className="w-24 text-xs text-gray-500">{a === agent.id ? "agent" : i === 1 ? "N+1 (rédige)" : `N+${i}`}</span>
                <button type="button" className="btn-secondaire px-2 py-1 text-xs" disabled={i === 0} onClick={() => deplacer(i, -1)} aria-label="Monter">↑</button>
                <button type="button" className="btn-secondaire px-2 py-1 text-xs" disabled={i === acteurs.length - 1} onClick={() => deplacer(i, 1)} aria-label="Descendre">↓</button>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => { setActeurs((t) => t.filter((_, j) => j !== i)); setCle((k) => k + 1); }}>Retirer</button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondaire" onClick={() => { setActeurs((t) => [...t.slice(0, -1), null, t[t.length - 1]]); setCle((k) => k + 1); }}>+ Ajouter un niveau avant le visa final</button>
            <button type="button" className="btn-primaire" onClick={sauver}>{entretienId ? "Enregistrer le circuit" : `Créer le dossier ${annee}`}</button>
          </div>
          {entretienId && statut === "redaction" && redacteurId !== acteurs[1] && (
            <p className="text-xs text-gray-500">Le N+1 (rédacteur) sera mis à jour selon la 2e ligne.</p>
          )}
        </>
      ) : (
        <ol className="space-y-2">
          {etapes.map((e) => (
            <EtapeRemplacable key={e.id} e={e} personnes={personnes} onMsg={setMsg} agentId={agent.id} />
          ))}
        </ol>
      )}
      {msg && <p className={`rounded-lg p-2 text-sm ${msg.ok ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-red-50 text-red-700"}`}>{msg.texte}</p>}
    </div>
  );
}

function EtapeRemplacable({ e, personnes, onMsg, agentId }: { e: EtapeVue; personnes: Personne[]; onMsg: (m: { ok: boolean; texte: string }) => void; agentId: number }) {
  const router = useRouter();
    const [nv, setNv] = useState<number | null>(null);
    const nom = personnes.find((p) => p.id === e.acteurId)?.libelle ?? "?";
    return (
      <li className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-6 text-right text-xs text-gray-400">{e.ordre}.</span>
        <span className="min-w-48 flex-1 font-medium">{nom}</span>
        {e.vise ? (
          <span className="badge bg-sjr-primaire-doux text-sjr-primaire-fonce">visé</span>
        ) : e.acteurId === agentId ? (
          <span className="badge bg-gray-100 text-gray-600">agent</span>
        ) : (
          <>
            <div className="w-64"><ChoixPersonne id={`r${e.id}`} personnes={personnes} valeur={null} onChange={setNv} /></div>
            <button
              className="btn-secondaire py-1 text-xs"
              disabled={!nv}
              onClick={async () => {
                const r = await remplacerActeurEtape(e.id, nv!);
                onMsg({ ok: r.ok, texte: r.message });
                if (r.ok) router.refresh();
              }}
            >
              Remplacer
            </button>
          </>
        )}
      </li>
    );
}

export function BoutonCode({ agentId, code }: { agentId: number; code: string | null }) {
  const [c, setC] = useState(code);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {c ? (
        <span className="text-sm">Code provisoire : <strong className="font-mono tracking-widest">{c}</strong></span>
      ) : (
        <span className="text-sm text-gray-500">L'agent a choisi son mot de passe.</span>
      )}
      <button
        className="btn-secondaire py-1.5"
        onClick={async () => {
          if (!confirm("Générer un nouveau code ? L'ancien mot de passe ne fonctionnera plus.")) return;
          setC(await reinitialiserCode(agentId));
        }}
      >
        Générer un nouveau code
      </button>
    </div>
  );
}

export function ChangerRedacteur({ entretienId, personnes, actuel }: { entretienId: number; personnes: Personne[]; actuel: number | null }) {
  const router = useRouter();
  const [v, setV] = useState<number | null>(actuel);
  const [m, setM] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-72"><ChoixPersonne id="redac" personnes={personnes} valeur={actuel} onChange={setV} /></div>
      <button className="btn-secondaire py-1.5" disabled={!v || v === actuel} onClick={async () => { const r = await changerRedacteur(entretienId, v!); setM(r.message); router.refresh(); }}>Changer le rédacteur</button>
      {m && <span className="text-sm text-gray-600">{m}</span>}
    </div>
  );
}

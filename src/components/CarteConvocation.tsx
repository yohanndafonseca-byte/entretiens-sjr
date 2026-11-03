"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convoquer } from "@/app/entretiens/[id]/actions";

type Props = {
  id: number;
  peutConvoquer: boolean;
  convocationLe: string | null;
  lieu: string | null;
  envoyeeLe: string | null;
  fichePosteNom: string | null;
  agentAEmail: boolean;
  limiteNotification: string | null; // AAAA-MM-JJ : date limite pour transmettre le CR (15 j)
  enRedaction: boolean;
};

const DELAI = 8;
const fr = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const heure = (local: string) => local.slice(11, 16).replace(":", " h ");

export function CarteConvocation(p: Props) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(!p.convocationLe);
  const [quand, setQuand] = useState(p.convocationLe ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const minimum = new Date(Date.now() + DELAI * 86_400_000).toISOString().slice(0, 10);
  const jours = quand ? Math.floor((new Date(quand).getTime() - Date.now()) / 86_400_000) : null;
  const tropTot = jours !== null && jours < DELAI;

  const documents = p.convocationLe && (
    <div className="flex flex-wrap gap-2 text-xs">
      <a className="btn-secondaire py-1 text-xs" href={`/entretiens/${p.id}/convocation`} target="_blank" rel="noreferrer">📄 Convocation</a>
      <a className="btn-secondaire py-1 text-xs" href={`/entretiens/${p.id}/fiche-entretien`} target="_blank" rel="noreferrer">📄 Fiche d'entretien</a>
      {p.fichePosteNom && <a className="btn-secondaire py-1 text-xs" href={`/entretiens/${p.id}/fiche-poste`} target="_blank" rel="noreferrer">📄 Fiche de poste</a>}
    </div>
  );

  if (!p.enRedaction && !p.convocationLe) return null;

  return (
    <div className="carte p-4">
      <h2 className="mb-2 font-bold">📅 Entretien</h2>
      {p.convocationLe ? (
        <div className="mb-3 space-y-1 text-sm">
          <p>
            Prévu le <strong>{fr(p.convocationLe)} à {heure(p.convocationLe)}</strong>
            {p.lieu ? <> – {p.lieu}</> : null}
          </p>
          {p.envoyeeLe && <p className="text-xs text-gray-500">Convocation envoyée le {new Date(p.envoyeeLe).toLocaleDateString("fr-FR")}{p.agentAEmail ? " par e-mail" : " – à remettre en main propre (agent sans e-mail)"}.</p>}
          {documents}
        </div>
      ) : p.peutConvoquer ? (
        <p className="mb-2 text-xs text-gray-600">Fixez la date : l'agent reçoit sa convocation, la fiche d'entretien et sa fiche de poste, avec une invitation pour son agenda. Le décret impose au moins {DELAI} jours de délai.</p>
      ) : (
        <p className="text-sm text-gray-500">La date de votre entretien n'a pas encore été fixée par votre responsable.</p>
      )}

      {p.limiteNotification && p.enRedaction && (
        <p className={`mb-3 rounded-lg p-2 text-xs ${new Date(p.limiteNotification) < new Date() ? "bg-red-50 text-red-700" : "bg-sjr-attente-doux text-yellow-900"}`}>
          ⏱ Compte rendu à transmettre à l'agent avant le <strong>{fr(p.limiteNotification)}</strong> (15 jours après l'entretien).
        </p>
      )}

      {p.peutConvoquer && p.enRedaction && (
        <>
          {p.convocationLe && !ouvert && (
            <button className="text-xs text-sjr-primaire-fonce hover:underline" onClick={() => setOuvert(true)}>Modifier la date / renvoyer la convocation</button>
          )}
          {ouvert && (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setEnCours(true);
                setMsg(null);
                const r = await convoquer(p.id, new FormData(e.currentTarget));
                setEnCours(false);
                setMsg(r.ok ? { ok: true, texte: r.message ?? "" } : { ok: false, texte: r.erreur });
                if (r.ok) {
                  setOuvert(false);
                  router.refresh();
                }
              }}
            >
              <label className="etiquette">Date et heure</label>
              <input type="datetime-local" name="quand" className="champ" required value={quand} min={`${new Date().toISOString().slice(0, 10)}T08:00`} onChange={(e) => setQuand(e.target.value)} />
              {tropTot && (
                <div className="rounded-lg bg-sjr-attente-doux p-2 text-xs text-yellow-900">
                  Moins de {DELAI} jours (date conseillée : à partir du {fr(minimum)}). Si la date a été choisie d'un commun accord avec l'agent, indiquez-le :
                  <input name="motif" className="champ mt-1" placeholder="ex. date fixée d'un commun accord avec l'agent" />
                </div>
              )}
              <label className="etiquette">Lieu</label>
              <input name="lieu" className="champ" placeholder="ex. bureau du responsable, Hôtel de Ville" defaultValue={p.lieu ?? ""} />
              <label className="etiquette">Fiche de poste (PDF, facultatif)</label>
              <input type="file" name="fichePoste" accept=".pdf,.doc,.docx" className="text-xs" />
              {p.fichePosteNom && <p className="text-xs text-gray-500">Actuelle : {p.fichePosteNom}</p>}
              <button className="btn-primaire w-full" disabled={enCours}>{enCours ? "Envoi…" : p.convocationLe ? "Mettre à jour et renvoyer" : "Envoyer la convocation"}</button>
            </form>
          )}
        </>
      )}
      {msg && <p className={`mt-2 rounded-lg p-2 text-xs ${msg.ok ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-red-50 text-red-700"}`}>{msg.texte}</p>}
    </div>
  );
}

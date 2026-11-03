"use client";

import { useActionState, useState } from "react";
import { creerAgent } from "@/app/admin/actions";

type Option = { valeur: string; libelle: string };

export function FormNouvelAgent({ services, responsables, campagne }: { services: Option[]; responsables: { id: number; libelle: string }[]; campagne: { id: number; annee: number } | null }) {
  const [etat, action, enCours] = useActionState(creerAgent, undefined);
  const [respTexte, setRespTexte] = useState("");
  // reconnu par le libellé exact, par le matricule « (123456) », ou par un nom sans ambiguïté
  const t = respTexte.trim().toLowerCase();
  const mat = respTexte.match(/\((\d+)\)/)?.[1] ?? (/^\d{3,}$/.test(t) ? t : null);
  const candidats = t ? responsables.filter((r) => r.libelle.toLowerCase() === t || (mat && r.libelle.includes(`(${mat})`)) || r.libelle.toLowerCase().startsWith(t)) : [];
  const resp = candidats.length === 1 ? candidats[0] : candidats.find((r) => r.libelle.toLowerCase() === t);
  const champ = (name: string, label: string, opts: { requis?: boolean; type?: string; placeholder?: string } = {}) => (
    <div>
      <label className="etiquette" htmlFor={name}>{label}{opts.requis && " *"}</label>
      <input id={name} name={name} type={opts.type ?? "text"} required={opts.requis} placeholder={opts.placeholder} className="champ" />
    </div>
  );
  return (
    <form action={action} className="carte max-w-4xl space-y-5 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        {champ("matricule", "Matricule", { requis: true })}
        {champ("nom", "Nom", { requis: true })}
        {champ("prenom", "Prénom")}
        {champ("email", "E-mail professionnel", { type: "email", placeholder: "laisser vide si l'agent n'en a pas" })}
        <div>
          <label className="etiquette" htmlFor="statut">Statut</label>
          <select id="statut" name="statut" className="champ" defaultValue="TITULAIRE">
            <option>TITULAIRE</option>
            <option>STAGIAIRE</option>
            <option>CONTRACTUEL</option>
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="categorie">Catégorie</label>
          <select id="categorie" name="categorie" className="champ" defaultValue="">
            <option value="">—</option>
            <option>A</option>
            <option>B</option>
            <option>C</option>
          </select>
        </div>
        {champ("grade", "Grade")}
        {champ("poste", "Intitulé du poste")}
        <div>
          <label className="etiquette" htmlFor="tempsTravail">Temps de travail</label>
          <input id="tempsTravail" name="tempsTravail" className="champ" defaultValue="Temps Plein" />
        </div>
        <div className="md:col-span-2">
          <label className="etiquette" htmlFor="service">Service</label>
          <select id="service" name="service" className="champ" defaultValue="">
            <option value="">—</option>
            {services.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="etiquette" htmlFor="collectivite">Collectivité</label>
          <select id="collectivite" name="collectivite" className="champ" defaultValue="Ville"><option>Ville</option><option>CCAS</option></select>
        </div>
        <div className="md:col-span-3">
          <label className="etiquette" htmlFor="resp">Responsable direct (N+1)</label>
          <input id="resp" className="champ" list="liste-resp" value={respTexte} onChange={(e) => setRespTexte(e.target.value)} placeholder="Tapez un nom ou un matricule…" />
          <datalist id="liste-resp">{responsables.map((r) => <option key={r.id} value={r.libelle} />)}</datalist>
          <input type="hidden" name="responsableId" value={resp?.id ?? ""} />
          {respTexte && (
            <p className={`mt-1 text-xs ${resp ? "text-sjr-primaire-fonce" : "text-yellow-800"}`}>
              {resp ? `✓ ${resp.libelle}` : candidats.length > 1 ? `${candidats.length} personnes correspondent : précisez (matricule)` : "Aucune personne trouvée : vérifiez le nom ou le matricule"}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">Le reste du circuit (N+2, direction, DGS) est déduit automatiquement de la hiérarchie de ce responsable.</p>
        </div>
      </div>
      {campagne && (
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="campagneId" value={campagne.id} />
          <input type="checkbox" name="creerDossier" defaultChecked /> Créer aussi son dossier d'entretien {campagne.annee}
        </label>
      )}
      {etat?.erreur && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{etat.erreur}</p>}
      <div className="flex gap-2">
        <button className="btn-primaire" disabled={enCours}>{enCours ? "Création…" : "Ajouter l'agent"}</button>
        <a href="/admin/agents" className="btn-secondaire">Annuler</a>
      </div>
      <p className="text-xs text-gray-500">Un code personnel provisoire est créé automatiquement. Au prochain import de l'export Inser/Ciril, sa fiche sera mise à jour avec les données officielles (même matricule).</p>
    </form>
  );
}

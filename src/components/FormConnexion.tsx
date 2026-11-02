"use client";

import { useActionState } from "react";
import { connexion, changerMotDePasse } from "@/app/auth-actions";

export function FormConnexion() {
  const [etat, action, enCours] = useActionState(connexion, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="etiquette" htmlFor="matricule">Matricule</label>
        <input id="matricule" name="matricule" className="champ" inputMode="numeric" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label className="etiquette" htmlFor="motdepasse">Code personnel / mot de passe</label>
        <input id="motdepasse" name="motdepasse" type="password" className="champ" autoComplete="current-password" required />
      </div>
      {etat?.erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{etat.erreur}</p>}
      <button className="btn-primaire w-full" disabled={enCours}>{enCours ? "Connexion…" : "Se connecter"}</button>
      <p className="text-center text-xs text-gray-500">Code oublié ? Contactez le service des Ressources Humaines.</p>
    </form>
  );
}

export function FormMotDePasse() {
  const [etat, action, enCours] = useActionState(changerMotDePasse, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="etiquette" htmlFor="actuel">Code actuel (remis par les RH)</label>
        <input id="actuel" name="actuel" type="password" className="champ" required autoFocus />
      </div>
      <div>
        <label className="etiquette" htmlFor="nouveau">Nouveau mot de passe (8 caractères minimum)</label>
        <input id="nouveau" name="nouveau" type="password" className="champ" minLength={8} autoComplete="new-password" required />
      </div>
      <div>
        <label className="etiquette" htmlFor="confirmation">Confirmation</label>
        <input id="confirmation" name="confirmation" type="password" className="champ" minLength={8} autoComplete="new-password" required />
      </div>
      {etat?.erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{etat.erreur}</p>}
      <button className="btn-primaire w-full" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}

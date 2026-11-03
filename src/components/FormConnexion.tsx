"use client";

import { useActionState } from "react";
import { connexion, changerMotDePasse, demanderReinitialisation, reinitialiserMotDePasse } from "@/app/auth-actions";

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
      <p className="text-center text-sm">
        <a href="/mot-de-passe-oublie" className="text-sjr-primaire-fonce hover:underline">Mot de passe ou code oublié ?</a>
      </p>
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

export function FormOubli() {
  const [etat, action, enCours] = useActionState(demanderReinitialisation, undefined);
  if (etat?.info)
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-sjr-primaire-doux p-3 text-sm text-sjr-primaire-fonce">{etat.info}</p>
        <a href="/connexion" className="btn-secondaire w-full">Retour à la connexion</a>
      </div>
    );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="etiquette" htmlFor="identifiant">Matricule ou adresse e-mail</label>
        <input id="identifiant" name="identifiant" className="champ" required autoFocus />
      </div>
      {etat?.erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{etat.erreur}</p>}
      <button className="btn-primaire w-full" disabled={enCours}>{enCours ? "Envoi…" : "Recevoir un lien par e-mail"}</button>
      <p className="text-center text-xs text-gray-500">Vous n'avez pas d'adresse e-mail ? Votre responsable ou le service RH peut vous donner un nouveau code.</p>
      <p className="text-center text-sm"><a href="/connexion" className="text-sjr-primaire-fonce hover:underline">← Retour</a></p>
    </form>
  );
}

export function FormReinitialiser({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState(reinitialiserMotDePasse, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jeton" value={jeton} />
      <div>
        <label className="etiquette" htmlFor="nouveau">Nouveau mot de passe (8 caractères minimum)</label>
        <input id="nouveau" name="nouveau" type="password" className="champ" minLength={8} autoComplete="new-password" required autoFocus />
      </div>
      <div>
        <label className="etiquette" htmlFor="confirmation">Confirmation</label>
        <input id="confirmation" name="confirmation" type="password" className="champ" minLength={8} autoComplete="new-password" required />
      </div>
      {etat?.erreur && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{etat.erreur}</p>}
      <button className="btn-primaire w-full" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer et me connecter"}</button>
    </form>
  );
}

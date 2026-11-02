"use client";
export function BoutonImprimer() {
  return <button className="btn-primaire" onClick={() => window.print()}>Imprimer</button>;
}

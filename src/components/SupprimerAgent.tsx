"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supprimerAgent } from "@/app/admin/actions";

export function SupprimerAgent({ id, nom }: { id: number; nom: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        Un agent qui a déjà des comptes rendus visés n'est pas effacé mais <strong>archivé</strong> (plus de connexion, plus de campagne), pour conserver ses documents. Sinon il est supprimé définitivement.
      </p>
      <button
        className="btn-danger"
        disabled={enCours}
        onClick={async () => {
          if (!confirm(`Supprimer ${nom} ?\n\nSes brouillons de compte rendu non visés seront supprimés.`)) return;
          setEnCours(true);
          const r = await supprimerAgent(id);
          setEnCours(false);
          setMsg({ ok: r.ok, texte: r.message });
          if (r.ok) router.refresh();
        }}
      >
        Supprimer l'agent
      </button>
      {msg && (
        <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-sjr-primaire-doux text-sjr-primaire-fonce" : "bg-red-50 text-red-700"}`}>
          {msg.texte}
          {!msg.ok && msg.texte.includes("Remplacer") && (
            <a href="/admin/remplacer" className="ml-1 font-medium underline">Remplacer maintenant →</a>
          )}
        </p>
      )}
    </div>
  );
}

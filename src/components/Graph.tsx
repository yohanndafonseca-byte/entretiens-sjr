/** Petits graphiques HTML/CSS (barres empilées horizontales) – infobulle native au survol. */

export type Segment = { label: string; valeur: number; couleur: string; motif?: boolean };

export function BarreEmpilee({ segments, total, hauteur = 14 }: { segments: Segment[]; total: number; hauteur?: number }) {
  if (!total) return <div className="h-3 rounded bg-gray-100" />;
  return (
    <div className="flex w-full gap-[2px]" style={{ height: hauteur }}>
      {segments
        .filter((s) => s.valeur > 0)
        .map((s, i, arr) => (
          <div
            key={s.label}
            title={`${s.label} : ${s.valeur} (${Math.round((s.valeur / total) * 100)} %)`}
            className={`${i === 0 ? "rounded-l" : ""} ${i === arr.length - 1 ? "rounded-r" : ""} cursor-default transition-opacity hover:opacity-80`}
            style={{
              width: `${(s.valeur / total) * 100}%`,
              background: s.motif
                ? `repeating-linear-gradient(45deg, ${s.couleur}, ${s.couleur} 3px, #ffffff 3px, #ffffff 6px)`
                : s.couleur,
            }}
          />
        ))}
    </div>
  );
}

export function Legende({ items }: { items: Omit<Segment, "valeur">[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
      {items.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{
              background: s.motif ? `repeating-linear-gradient(45deg, ${s.couleur}, ${s.couleur} 2px, #fff 2px, #fff 4px)` : s.couleur,
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function Tuile({ titre, valeur, detail, accent }: { titre: string; valeur: string | number; detail?: string; accent?: boolean }) {
  return (
    <div className={`carte p-4 ${accent ? "border-t-4 border-t-sjr-vert" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titre}</div>
      <div className="mt-1 text-3xl font-bold text-encre">{valeur}</div>
      {detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
    </div>
  );
}

/** Rampe séquentielle verte (une seule teinte, du clair au foncé) pour les échelles ordonnées. */
export const RAMPE = { clair: "#c4e8d0", moyen: "#4fbf78", fonce: "#00802f", neutre: "#b8bcc2" };

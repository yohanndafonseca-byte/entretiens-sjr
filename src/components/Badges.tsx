export function BadgeStatut({ statut, libelle }: { statut: string; libelle: string }) {
  const cls =
    statut === "termine"
      ? "bg-sjr-primaire-doux text-sjr-primaire-fonce"
      : statut === "redaction"
        ? "bg-gray-100 text-gray-700"
        : "bg-sjr-attente-doux text-yellow-800 ring-1 ring-yellow-300";
  return <span className={`badge ${cls}`}>{libelle}</span>;
}

export function Progression({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-1" title={`Étape ${Math.min(index + 1, total)} sur ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-full ${i < index ? "bg-sjr-primaire" : i === index ? "bg-sjr-attente ring-1 ring-yellow-400" : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

export const joursDepuis = (d: Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

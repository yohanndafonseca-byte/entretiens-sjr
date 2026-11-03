"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AVIS,
  ECHELLE,
  INITIATIVES,
  RESULTATS,
  RUBRIQUES,
  TOUS_CRITERES,
  verifierCompletude,
  type ContenuCR,
  type VoeuMobilite,
  type VoeuTexte,
} from "@/lib/formulaire";
import { enregistrerBrouillon, viserRedaction } from "@/app/entretiens/[id]/actions";

type Props = {
  id: number;
  editable: boolean;
  contenuInitial: ContenuCR;
  dateInitiale: string | null;
  entete: { agent: string; services: string[]; grade: string; poste: string; statut: string; tempsTravail: string; redacteur: string; annee: number };
  objectifsVille: string;
  objectifsDirection: { libelle: string; texte: string }[];
};

const SECTIONS = [
  { id: "s-entete", label: "Agent" },
  { id: "s-1", label: "I. Objectifs N-1" },
  { id: "s-2", label: "II. Carrière" },
  { id: "s-3", label: "III. Manière de servir" },
  { id: "s-4", label: "IV. Objectifs" },
  { id: "s-5", label: "V. Formation" },
  { id: "s-6", label: "VI. Vœux & appréciation" },
];

function Zone({ value, onChange, disabled, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; disabled: boolean; rows?: number; placeholder?: string }) {
  return (
    <textarea
      className="champ resize-y"
      rows={rows}
      value={value}
      placeholder={disabled ? "" : placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Section({ id, titre, children, aide }: { id: string; titre: string; children: React.ReactNode; aide?: string }) {
  return (
    <section id={id} className="carte scroll-mt-24 p-5">
      <h2 className="mb-1 text-base font-bold text-sjr-primaire-fonce">{titre}</h2>
      {aide && <p className="mb-4 text-xs text-gray-500">{aide}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Pastilles({ note, onChange, disabled }: { note: number | null; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {ECHELLE.map((e) => {
        const actif = note === e.valeur;
        return (
          <button
            type="button"
            key={e.valeur}
            role="radio"
            aria-checked={actif}
            disabled={disabled}
            title={e.libelle}
            onClick={() => onChange(e.valeur)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${
              actif
                ? e.valeur === 4
                  ? "border-sjr-primaire bg-sjr-primaire-doux text-sjr-primaire-fonce"
                  : e.valeur === 3
                    ? "border-yellow-400 bg-sjr-attente-doux text-yellow-900"
                    : e.valeur === 2
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-gray-400 bg-gray-100 text-gray-800"
                : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
            } ${disabled && !actif ? "opacity-40" : ""}`}
          >
            <span className="flex gap-0.5">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-2 w-2 rounded-full ${i <= e.valeur ? "bg-amber-500" : "bg-gray-300"}`} />
              ))}
            </span>
            <span className="hidden sm:inline">{e.court}</span>
          </button>
        );
      })}
    </div>
  );
}

function BoutonAjout({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled: boolean }) {
  if (disabled) return null;
  return (
    <button type="button" onClick={onClick} className="btn-secondaire border-dashed text-sjr-primaire-fonce">
      + {children}
    </button>
  );
}

function BoutonSuppr({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  if (disabled) return null;
  return (
    <button type="button" onClick={onClick} className="text-xs text-red-600 hover:underline" title="Supprimer la ligne">
      Supprimer
    </button>
  );
}

function ChoixAvis({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <>
      <input className="champ" list="liste-avis" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={disabled ? "" : "Avis…"} />
    </>
  );
}

export function FormulaireCR({ id, editable, contenuInitial, dateInitiale, entete, objectifsVille, objectifsDirection }: Props) {
  const router = useRouter();
  const [c, setC] = useState<ContenuCR>(contenuInitial);
  const [date, setDate] = useState<string>(dateInitiale ?? "");
  const [etatSauvegarde, setEtatSauvegarde] = useState<"" | "attente" | "enCours" | "ok" | "erreur">("");
  const [heureSauvegarde, setHeureSauvegarde] = useState<string>("");
  const [modeEntretien, setModeEntretien] = useState(false);
  const [erreurVisa, setErreurVisa] = useState<string>("");
  const [visaEnCours, setVisaEnCours] = useState(false);
  const premier = useRef(true);
  const dis = !editable;

  const maj = useCallback((f: (x: ContenuCR) => ContenuCR) => setC((x) => f(structuredClone(x))), []);

  // Enregistrement automatique 1,5 s après la dernière modification
  useEffect(() => {
    if (!editable) return;
    if (premier.current) {
      premier.current = false;
      return;
    }
    setEtatSauvegarde("attente");
    const t = setTimeout(async () => {
      setEtatSauvegarde("enCours");
      try {
        const r = await enregistrerBrouillon(id, c, date || null);
        setEtatSauvegarde(r.ok ? "ok" : "erreur");
        setHeureSauvegarde(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      } catch {
        setEtatSauvegarde("erreur");
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [c, date, editable, id]);

  useEffect(() => {
    const avant = (e: BeforeUnloadEvent) => {
      if (etatSauvegarde === "attente" || etatSauvegarde === "enCours") e.preventDefault();
    };
    window.addEventListener("beforeunload", avant);
    return () => window.removeEventListener("beforeunload", avant);
  }, [etatSauvegarde]);

  useEffect(() => {
    document.body.classList.toggle("mode-entretien", modeEntretien);
  }, [modeEntretien]);

  const manques = editable ? verifierCompletude(c, date || null) : [];
  const nbNotes = TOUS_CRITERES.filter((k) => c.criteres[k.id]?.note).length;

  async function viserEtTransmettre() {
    setErreurVisa("");
    if (!confirm("Viser le compte rendu et le transmettre à l'agent ? Il ne sera plus modifiable, sauf renvoi en rédaction.")) return;
    setVisaEnCours(true);
    const r = await viserRedaction(id, c, date || null);
    setVisaEnCours(false);
    if (!r.ok) setErreurVisa(r.erreur);
    else {
      setModeEntretien(false);
      router.refresh();
    }
  }

  const voeuTexte = (cle: "carriere" | "environnement" | "organisation" | "autres", titre: string, aide?: string) => {
    const v: VoeuTexte = c.voeux[cle];
    return (
      <div className="grid gap-3 rounded-lg border border-gray-100 p-3 md:grid-cols-2">
        <div>
          <label className="etiquette">{titre}</label>
          {aide && <p className="mb-1 text-xs text-gray-400">{aide}</p>}
          <Zone value={v.texte} disabled={dis} onChange={(t) => maj((x) => ((x.voeux[cle].texte = t), x))} rows={2} />
        </div>
        <div>
          <label className="etiquette">Avis du/de la responsable</label>
          <Zone value={v.avis} disabled={dis} onChange={(t) => maj((x) => ((x.voeux[cle].avis = t), x))} rows={2} />
        </div>
      </div>
    );
  };

  const voeuMobilite = (cle: "evolutionPoste" | "changementInterne" | "changementExterne", titre: string) => {
    const v: VoeuMobilite = c.voeux[cle];
    return (
      <tr>
        <td className="font-medium">{titre}</td>
        <td>
          <select className="champ" value={v.souhait} disabled={dis} onChange={(e) => maj((x) => ((x.voeux[cle].souhait = e.target.value as VoeuMobilite["souhait"]), x))}>
            <option value="">—</option>
            <option>Oui</option>
            <option>Non</option>
          </select>
        </td>
        <td><input className="champ" value={v.avis} disabled={dis} onChange={(e) => maj((x) => ((x.voeux[cle].avis = e.target.value), x))} /></td>
        <td><input className="champ" value={v.precision} disabled={dis} onChange={(e) => maj((x) => ((x.voeux[cle].precision = e.target.value), x))} /></td>
      </tr>
    );
  };

  return (
    <div className={modeEntretien ? "fixed inset-0 z-50 overflow-y-auto bg-[#f5f6f4] text-[15px]" : ""}>
      <datalist id="liste-avis">{AVIS.map((a) => <option key={a} value={a} />)}</datalist>

      {/* Barre collante : navigation + état de l'enregistrement */}
      <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap items-center gap-2 rounded-b-xl border-b border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
        <nav className="flex flex-1 flex-wrap gap-1 text-xs">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md px-2 py-1 text-gray-600 hover:bg-sjr-primaire-doux hover:text-sjr-primaire-fonce">{s.label}</a>
          ))}
        </nav>
        {editable && (
          <span className="text-xs text-gray-500" aria-live="polite">
            {etatSauvegarde === "attente" || etatSauvegarde === "enCours"
              ? "Enregistrement…"
              : etatSauvegarde === "ok"
                ? `✓ Brouillon enregistré à ${heureSauvegarde}`
                : etatSauvegarde === "erreur"
                  ? "⚠ Échec de l'enregistrement – vérifiez la connexion"
                  : "Enregistrement automatique activé"}
          </span>
        )}
        {editable && (
          <button type="button" className="btn-secondaire py-1 text-xs" onClick={() => setModeEntretien((m) => !m)}>
            {modeEntretien ? "Quitter le mode entretien" : "Mode entretien (plein écran)"}
          </button>
        )}
      </div>

      <div className={`space-y-5 ${modeEntretien ? "mx-auto max-w-5xl px-4 pb-24" : ""}`}>
        <Section id="s-entete" titre={`Compte rendu de l'entretien professionnel annuel ${entete.annee}`}>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <div className="etiquette">Agent</div>
              <div className="font-semibold">{entete.agent}</div>
              <div className="text-xs text-gray-500">{entete.services.join(" › ")}</div>
            </div>
            <div>
              <div className="etiquette">Grade / poste</div>
              <div>{entete.grade || "—"}</div>
              <div className="text-gray-600">{entete.poste || "—"}</div>
            </div>
            <div>
              <div className="etiquette">Statut / temps de travail</div>
              <div>{entete.statut || "—"}</div>
              <div className="text-gray-600">{entete.tempsTravail || "—"}</div>
            </div>
            <div>
              <div className="etiquette">Responsable hiérarchique direct/e</div>
              <div className="font-semibold">{entete.redacteur}</div>
            </div>
            <div>
              <label className="etiquette" htmlFor="fonction">Fonction du responsable</label>
              <input id="fonction" className="champ" value={c.fonctionRedacteur} disabled={dis} onChange={(e) => maj((x) => ((x.fonctionRedacteur = e.target.value), x))} />
            </div>
            <div>
              <label className="etiquette" htmlFor="date">Entretien réalisé le *</label>
              <input id="date" type="date" className="champ" value={date} disabled={dis} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section id="s-1" titre="I – Appréciation de l'atteinte des objectifs fixés" aide="Les objectifs fixés lors de l'entretien précédent sont repris automatiquement. Ajoutez ceux fixés en cours d'année.">
          {c.objectifsPrecedents.length === 0 && <p className="text-sm text-gray-500">Aucun objectif n'avait été fixé l'an dernier dans l'application.</p>}
          {c.objectifsPrecedents.map((o, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-gray-100 p-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="etiquette">Objectif {o.ajouteEnCours && <span className="badge ml-1 bg-sjr-attente-doux normal-case text-yellow-800">ajouté en cours d'année</span>}</label>
                <Zone value={o.objectif} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.objectifsPrecedents[i].objectif = t), x))} />
              </div>
              <div className="md:col-span-3">
                <label className="etiquette">Résultat obtenu</label>
                <select className="champ" value={o.resultat} disabled={dis} onChange={(e) => maj((x) => ((x.objectifsPrecedents[i].resultat = e.target.value), x))}>
                  <option value="">—</option>
                  {RESULTATS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="etiquette">Analyse des écarts</label>
                <Zone value={o.analyse} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.objectifsPrecedents[i].analyse = t), x))} />
                <div className="mt-1 text-right"><BoutonSuppr disabled={dis} onClick={() => maj((x) => (x.objectifsPrecedents.splice(i, 1), x))} /></div>
              </div>
            </div>
          ))}
          <BoutonAjout disabled={dis} onClick={() => maj((x) => (x.objectifsPrecedents.push({ objectif: "", ajouteEnCours: true, resultat: "", analyse: "" }), x))}>
            Ajouter un objectif fixé en cours d'année
          </BoutonAjout>
          <div>
            <label className="etiquette">Expression libre de l'agent</label>
            <Zone value={c.expressionLibre} disabled={dis} onChange={(t) => maj((x) => ((x.expressionLibre = t), x))} placeholder="Ce que l'agent souhaite exprimer sur son année…" />
          </div>
        </Section>

        <Section id="s-2" titre="II – Carrière" aide="Agent réunissant les conditions statutaires pour prétendre à :">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-start gap-2 rounded-lg border border-gray-100 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={c.carriere.echelon} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.echelon = e.target.checked), x))} />
              <span className="flex-1">
                <span className="font-medium">Un avancement d'échelon</span>
                <span className="mt-2 block text-xs text-gray-500">Date d'effet</span>
                <input type="date" className="champ mt-1" value={c.carriere.echelonDateEffet} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.echelonDateEffet = e.target.value), x))} />
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-gray-100 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={c.carriere.grade} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.grade = e.target.checked), x))} />
              <span className="flex-1">
                <span className="font-medium">Un avancement de grade</span>
                <span className="mt-2 block text-xs text-gray-500">Date de réussite à l'examen professionnel</span>
                <input type="date" className="champ mt-1" value={c.carriere.gradeDateExamen} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.gradeDateExamen = e.target.value), x))} />
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-gray-100 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={c.carriere.promotion} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.promotion = e.target.checked), x))} />
              <span className="flex-1">
                <span className="font-medium">Une promotion interne</span>
                <span className="mt-2 block text-xs text-gray-500">Date(s) de réussite à l'examen professionnel</span>
                <input type="date" className="champ mt-1" value={c.carriere.promotionDateExamen1} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.promotionDateExamen1 = e.target.value), x))} />
                <input type="date" className="champ mt-1" value={c.carriere.promotionDateExamen2} disabled={dis} onChange={(e) => maj((x) => ((x.carriere.promotionDateExamen2 = e.target.value), x))} />
              </span>
            </label>
          </div>
          <p className="text-sm font-medium">Avis du supérieur hiérarchique sur les propositions :</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div><label className="etiquette">D'avancement sur le grade</label><Zone value={c.carriere.avisAvancementGrade} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.carriere.avisAvancementGrade = t), x))} /></div>
            <div><label className="etiquette">De promotion interne sur le grade</label><Zone value={c.carriere.avisPromotion1} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.carriere.avisPromotion1 = t), x))} /></div>
            <div><label className="etiquette">De promotion interne sur le grade</label><Zone value={c.carriere.avisPromotion2} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.carriere.avisPromotion2 = t), x))} /></div>
          </div>
        </Section>

        <Section id="s-3" titre="III – Appréciation de la manière de servir, des compétences et des acquis de l'expérience" aide={`${nbNotes} / ${TOUS_CRITERES.length} critères appréciés.`}>
          {RUBRIQUES.map((r) => (
            <div key={r.titre}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-700">{r.titre}</h3>
              {r.groupes.map((g, gi) => (
                <div key={gi} className="mb-3">
                  {g.titre && <h4 className="mb-1 text-sm font-semibold text-gray-600">{g.titre}</h4>}
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {g.criteres.map((k) => {
                      const v = c.criteres[k.id] ?? { note: null, remarque: "" };
                      return (
                        <div key={k.id} className="grid gap-2 p-3 lg:grid-cols-12 lg:items-center">
                          <div className="text-sm lg:col-span-4">{k.libelle}</div>
                          <div className="lg:col-span-5 xl:col-span-5">
                            <Pastilles note={v.note} disabled={dis} onChange={(n) => maj((x) => ((x.criteres[k.id] = { ...v, note: n }), x))} />
                          </div>
                          <div className="lg:col-span-3">
                            <input className="champ" placeholder={dis ? "" : "Remarque"} value={v.remarque} disabled={dis} onChange={(e) => maj((x) => ((x.criteres[k.id] = { ...v, remarque: e.target.value }), x))} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Section>

        <Section id="s-4" titre="IV – Définition des objectifs">
          <details className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm" open={!editable ? false : undefined}>
            <summary className="cursor-pointer font-medium">Objectifs généraux de la Ville et de la direction / du pôle</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="whitespace-pre-line text-gray-700">{objectifsVille || <em className="text-gray-400">Non renseignés par les RH pour cette campagne.</em>}</div>
              <div className="space-y-2 text-gray-700">
                {objectifsDirection.length ? (
                  objectifsDirection.map((o) => (
                    <div key={o.libelle}>
                      <div className="font-semibold">{o.libelle}</div>
                      <div className="whitespace-pre-line">{o.texte}</div>
                    </div>
                  ))
                ) : (
                  <em className="text-gray-400">Pas d'objectifs de direction / pôle renseignés.</em>
                )}
              </div>
            </div>
          </details>
          <h3 className="text-sm font-bold">Objectifs individuels de l'agent *</h3>
          {c.objectifs.map((o, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-gray-100 p-3 md:grid-cols-12">
              <div className="md:col-span-4"><label className="etiquette">Objectif</label><Zone value={o.objectif} disabled={dis} rows={3} onChange={(t) => maj((x) => ((x.objectifs[i].objectif = t), x))} /></div>
              <div className="md:col-span-6"><label className="etiquette">Moyens</label><Zone value={o.moyens} disabled={dis} rows={3} onChange={(t) => maj((x) => ((x.objectifs[i].moyens = t), x))} /></div>
              <div className="md:col-span-2">
                <label className="etiquette">Échéance</label>
                <input type="date" className="champ" value={o.echeance} disabled={dis} onChange={(e) => maj((x) => ((x.objectifs[i].echeance = e.target.value), x))} />
                <div className="mt-2 text-right"><BoutonSuppr disabled={dis} onClick={() => maj((x) => (x.objectifs.splice(i, 1), x))} /></div>
              </div>
            </div>
          ))}
          <BoutonAjout disabled={dis} onClick={() => maj((x) => (x.objectifs.push({ objectif: "", moyens: "", echeance: date ? `${Number(date.slice(0, 4)) + 1}${date.slice(4)}` : "" }), x))}>
            Ajouter un objectif
          </BoutonAjout>
        </Section>

        <Section id="s-5" titre="V – Formation">
          <h3 className="text-sm font-bold">Actions suivies durant l'année</h3>
          {c.formationsSuivies.map((f, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-gray-100 p-3 md:grid-cols-4">
              <div><label className="etiquette">Intitulé</label><Zone value={f.intitule} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.formationsSuivies[i].intitule = t), x))} /></div>
              <div><label className="etiquette">Motivations : objectifs</label><Zone value={f.motivations} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.formationsSuivies[i].motivations = t), x))} /></div>
              <div><label className="etiquette">Évaluation à froid</label><Zone value={f.evaluation} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.formationsSuivies[i].evaluation = t), x))} /></div>
              <div>
                <label className="etiquette">Réinvestissement des acquis</label>
                <Zone value={f.commentaires} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.formationsSuivies[i].commentaires = t), x))} />
                <div className="mt-1 text-right"><BoutonSuppr disabled={dis} onClick={() => maj((x) => (x.formationsSuivies.splice(i, 1), x))} /></div>
              </div>
            </div>
          ))}
          <BoutonAjout disabled={dis} onClick={() => maj((x) => (x.formationsSuivies.push({ intitule: "", motivations: "", evaluation: "", commentaires: "" }), x))}>Ajouter une formation suivie</BoutonAjout>
          <div><label className="etiquette">Remarques sur les formations suivies</label><Zone value={c.remarquesFormations} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.remarquesFormations = t), x))} /></div>

          <h3 className="pt-2 text-sm font-bold">Besoins de formation</h3>
          {c.besoinsFormation.map((b, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-gray-100 p-3 md:grid-cols-12">
              <div className="md:col-span-2">
                <label className="etiquette">À l'initiative de</label>
                <select className="champ" value={b.initiative} disabled={dis} onChange={(e) => maj((x) => ((x.besoinsFormation[i].initiative = e.target.value), x))}>
                  <option value="">—</option>
                  {INITIATIVES.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="md:col-span-3"><label className="etiquette">Formation (catalogue)</label><Zone value={b.catalogue} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.besoinsFormation[i].catalogue = t), x))} /></div>
              <div className="md:col-span-4"><label className="etiquette">Besoin (expression libre) et objectif</label><Zone value={b.besoin} disabled={dis} rows={2} onChange={(t) => maj((x) => ((x.besoinsFormation[i].besoin = t), x))} /></div>
              <div className="md:col-span-3">
                <label className="etiquette">Avis du responsable</label>
                <ChoixAvis value={b.avis} disabled={dis} onChange={(t) => maj((x) => ((x.besoinsFormation[i].avis = t), x))} />
                <div className="mt-1 text-right"><BoutonSuppr disabled={dis} onClick={() => maj((x) => (x.besoinsFormation.splice(i, 1), x))} /></div>
              </div>
            </div>
          ))}
          <BoutonAjout disabled={dis} onClick={() => maj((x) => (x.besoinsFormation.push({ initiative: "", catalogue: "", besoin: "", avis: "" }), x))}>Ajouter un besoin de formation</BoutonAjout>
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            Tous les agents titulaires sont tenus à une obligation de formation de professionnalisation tout au long de la carrière, de 2 à 10 jours par période de 5 ans (hors filière Police). Toute demande de l'agent doit être relevée dans ce tableau ; l'avis du/de la responsable est requis pour les demandes liées au poste occupé.
          </p>
        </Section>

        <Section id="s-6" titre="VI – Vœux de l'agent">
          {voeuTexte("carriere", "Carrière, grade, statut")}
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="tableau">
              <thead>
                <tr><th>Évolution de fonction, mobilité – l'agent souhaite :</th><th className="w-28"></th><th>Avis du responsable</th><th>Précision de l'agent</th></tr>
              </thead>
              <tbody>
                {voeuMobilite("evolutionPoste", "Une évolution de ses fonctions sur le poste actuel")}
                {voeuMobilite("changementInterne", "Un changement de poste au sein de la collectivité")}
                {voeuMobilite("changementExterne", "Un changement de poste en dehors de la collectivité")}
              </tbody>
            </table>
          </div>
          {voeuTexte("environnement", "Environnement du poste", "Besoins matériel, hygiène et sécurité au travail…")}
          {voeuTexte("organisation", "Organisation du travail")}
          {voeuTexte("autres", "Autres vœux")}
          <div className="rounded-lg border-2 border-sjr-primaire/30 bg-sjr-primaire-doux/40 p-3">
            <label className="etiquette text-sjr-primaire-fonce">Appréciation générale de la valeur professionnelle de l'agent par le/la responsable hiérarchique direct/e *</label>
            <Zone value={c.appreciationGenerale} disabled={dis} rows={6} onChange={(t) => maj((x) => ((x.appreciationGenerale = t), x))} />
          </div>
        </Section>

        {editable && (
          <section className="carte border-t-4 border-t-sjr-primaire p-5">
            <h2 className="mb-2 text-base font-bold">Viser et transmettre</h2>
            {manques.length ? (
              <div className="mb-3 rounded-lg bg-sjr-attente-doux p-3 text-sm text-yellow-900">
                <p className="font-medium">Avant de viser, il reste à compléter :</p>
                <ul className="ml-5 list-disc">{manques.map((m) => <li key={m}>{m}</li>)}</ul>
              </div>
            ) : (
              <p className="mb-3 text-sm text-gray-600">Le compte rendu est complet. Une fois visé, il part à l'agent puis à la ligne hiérarchique.</p>
            )}
            {erreurVisa && <p className="mb-3 whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurVisa}</p>}
            <button className="btn-primaire" disabled={visaEnCours || manques.length > 0} onClick={viserEtTransmettre}>
              {visaEnCours ? "Transmission…" : "Je vise le compte rendu et le transmets"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

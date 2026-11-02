import { exigerUtilisateur } from "@/lib/auth";
import { Coquille } from "@/components/Entete";

const Bloc = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <section className="carte p-5">
    <h2 className="mb-3 text-lg font-bold text-sjr-vert-fonce">{titre}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-gray-700">{children}</div>
  </section>
);

export default async function Aide() {
  const u = await exigerUtilisateur();
  return (
    <Coquille u={u}>
      <h1 className="mb-6 text-2xl font-bold">Aide</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Bloc titre="Le circuit d'un compte rendu">
          <ol className="ml-5 list-decimal space-y-1">
            <li><strong>Le N+1 rédige</strong> le compte rendu (avant, pendant ou après l'entretien). Tout est enregistré automatiquement.</li>
            <li>Il <strong>vise et transmet</strong> : le compte rendu n'est plus modifiable.</li>
            <li><strong>L'agent vise</strong> (prise de connaissance, avec observations éventuelles).</li>
            <li><strong>Chaque supérieur vise</strong> dans l'ordre (N+1, N+2… jusqu'à la DGS).</li>
            <li><strong>L'agent vise une dernière fois</strong> : le compte rendu est définitif, il le reçoit en PDF par e-mail.</li>
          </ol>
          <p>À chaque étape, la personne concernée est prévenue par e-mail, puis relancée si rien ne se passe.</p>
        </Bloc>
        <Bloc titre="Je suis agent">
          <p>Quand c'est à vous de viser, le dossier apparaît dans <strong>« À traiter »</strong>. Lisez le compte rendu, ajoutez vos observations si vous le souhaitez, cochez « J'ai pris connaissance » puis <strong>Viser</strong>.</p>
          <p>Viser ne veut pas dire être d'accord : c'est la preuve que vous avez pris connaissance du document. Les voies de recours sont rappelées à la fin du PDF.</p>
          <p>Pas d'ordinateur ? Vous pouvez viser <strong>sur le poste de votre responsable</strong> avec votre code personnel, ou signer la version papier que les RH enregistreront.</p>
        </Bloc>
        <Bloc titre="Je suis responsable (N+1)">
          <p>Ouvrez le dossier de l'agent depuis « À traiter ». La partie I reprend automatiquement les objectifs fixés l'an dernier.</p>
          <p>Le bouton <strong>« Mode entretien »</strong> affiche le formulaire en plein écran, pratique pour saisir pendant l'entretien.</p>
          <p>Les champs marqués * sont obligatoires pour viser : date de l'entretien, les 15 critères, au moins un objectif, l'appréciation générale.</p>
          <p>Si l'agent est à côté de vous au moment de son visa, utilisez « Faire viser l'agent sur ce poste ».</p>
        </Bloc>
        <Bloc titre="Je suis N+2, N+3, direction">
          <p>Vous voyez les comptes rendus de votre ligne hiérarchique. Quand c'est votre tour, ajoutez vos observations et visez.</p>
          <p>Une correction de fond est nécessaire ? <strong>« Renvoyer en rédaction »</strong> avec un motif : le N+1 corrige et le circuit recommence depuis le début (les visas sont annulés).</p>
        </Bloc>
        <Bloc titre="Mot de passe">
          <p>Première connexion : matricule + code personnel remis par les RH, puis vous choisissez votre mot de passe. Oubli : demandez un nouveau code aux RH.</p>
          <p>Pour changer votre mot de passe, cliquez sur votre nom en haut à droite.</p>
        </Bloc>
      </div>
    </Coquille>
  );
}

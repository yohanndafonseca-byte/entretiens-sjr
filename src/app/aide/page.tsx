import { exigerUtilisateur } from "@/lib/auth";
import { Coquille } from "@/components/Entete";

const Bloc = ({ titre, children }: { titre: string; children: React.ReactNode }) => (
  <section className="carte p-5">
    <h2 className="mb-3 text-lg font-bold text-sjr-primaire-fonce">{titre}</h2>
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
            <li><strong>Le N+1 convoque l'agent</strong> au moins 8 jours avant (convocation, fiche de poste, fiche d'entretien, invitation agenda).</li>
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
          <p><strong>Avant l'entretien</strong> : dans le dossier, carte « 📅 Entretien », choisissez la date (au moins 8 jours plus tard) et le lieu, joignez la fiche de poste, puis envoyez la convocation.</p>
          <p>Ouvrez le dossier de l'agent depuis « À traiter ». La partie I reprend automatiquement les objectifs fixés l'an dernier, et l'appréciation de l'an dernier est rappelée sous chaque critère.</p>
          <p>Le compte rendu doit être transmis à l'agent dans les <strong>15 jours</strong> qui suivent l'entretien.</p>
          <p>Le bouton <strong>« Mode entretien »</strong> affiche le formulaire en plein écran, pratique pour saisir pendant l'entretien.</p>
          <p>Les champs marqués * sont obligatoires pour viser : date de l'entretien, les 15 critères, au moins un objectif, l'appréciation générale.</p>
          <p>Si l'agent est à côté de vous au moment de son visa, utilisez « Faire viser l'agent sur ce poste ».</p>
        </Bloc>
        <Bloc titre="Je suis N+2, N+3, direction">
          <p>Menu <strong>« Mes visas »</strong> : un résumé de chaque compte rendu qui attend votre visa. Cochez ceux que vous avez lus et visez-les <strong>en une fois</strong>. Pour ajouter une observation, ouvrez le dossier.</p>
          <p>Une correction de fond est nécessaire ? <strong>« Renvoyer en rédaction »</strong> avec un motif : le N+1 corrige et le circuit recommence depuis le début (les visas sont annulés).</p>
        </Bloc>
        <Bloc titre="Mot de passe">
          <p>Première connexion : matricule + code personnel, puis vous choisissez votre mot de passe.</p>
          <p><strong>Oubli</strong> : lien « Mot de passe ou code oublié ? » sur la page de connexion. Vous recevez un lien par e-mail. Sans adresse e-mail, demandez un nouveau code à votre responsable ou aux RH.</p>
          <p>Les agents sans outil informatique reçoivent un <strong>nouveau code à chaque campagne</strong> : il est imprimé sur la convocation à l'entretien.</p>
          <p>Après 5 essais ratés, le compte est bloqué 15 minutes.</p>
          <p>Pour changer votre mot de passe, cliquez sur votre nom en haut à droite.</p>
        </Bloc>
      </div>
    </Coquille>
  );
}

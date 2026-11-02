import { exigerUtilisateur } from "@/lib/auth";
import { CadreAuth } from "@/components/CadreAuth";
import { FormMotDePasse } from "@/components/FormConnexion";

export default async function PageMotDePasse() {
  const u = await exigerUtilisateur({ autoriserMdpProvisoire: true });
  return (
    <CadreAuth
      titre={u.mustChangePassword ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
      sousTitre={u.mustChangePassword ? `Bienvenue ${u.prenom} ! Pour votre première connexion, remplacez le code provisoire.` : undefined}
    >
      <FormMotDePasse />
    </CadreAuth>
  );
}

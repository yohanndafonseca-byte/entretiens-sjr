import { CadreAuth } from "@/components/CadreAuth";
import { FormOubli } from "@/components/FormConnexion";

export default function PageOubli() {
  return (
    <CadreAuth titre="Mot de passe oublié" sousTitre="Recevez un lien pour en choisir un nouveau">
      <FormOubli />
    </CadreAuth>
  );
}

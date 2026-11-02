import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { CadreAuth } from "@/components/CadreAuth";
import { FormConnexion } from "@/components/FormConnexion";

export default async function PageConnexion() {
  if (await utilisateurCourant()) redirect("/");
  return (
    <CadreAuth titre="Entretiens professionnels" sousTitre="Ville de Saint-Jean-de-la-Ruelle">
      <FormConnexion />
    </CadreAuth>
  );
}

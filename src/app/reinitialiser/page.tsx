import { CadreAuth } from "@/components/CadreAuth";
import { FormReinitialiser } from "@/components/FormConnexion";

export default async function PageReinitialiser({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton = "" } = await searchParams;
  return (
    <CadreAuth titre="Nouveau mot de passe">
      <FormReinitialiser jeton={jeton} />
    </CadreAuth>
  );
}

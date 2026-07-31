import { Picking } from "./picking";
import { CorreoTools } from "./correo";
import { EtiquetasMl } from "./etiquetas-ml";

// Las tres herramientas operativas de despacho en una sola ventana (antes /picking, /correo y
// /etiquetas por separado). Tab por searchParam — las rutas viejas redirigen acá con su tab.
// Los tabs los dibuja la nav del layout, indentados bajo Logística: acá eran invisibles desde
// cualquier otro panel.
export default async function Logistica({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const tab = t === "correo" || t === "etiquetas" ? t : "picking";
  return (
    <div className="space-y-6">
      {tab === "picking" && <Picking />}
      {tab === "correo" && <CorreoTools />}
      {tab === "etiquetas" && <EtiquetasMl />}
    </div>
  );
}

import { Picking } from "./picking";
import { Preparar } from "./preparar";
import { CorreoTools } from "./correo";
import { EtiquetasMl } from "./etiquetas-ml";

// Las tres herramientas operativas de despacho en una sola ventana (antes /picking, /correo y
// /etiquetas por separado). Tab por searchParam — las rutas viejas redirigen acá con su tab.
// Los tabs los dibuja la nav del layout, indentados bajo Logística: acá eran invisibles desde
// cualquier otro panel.
export default async function Logistica({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  // ojo: esta whitelist está duplicada en components/nav-link.tsx — un tab nuevo va en los dos lados
  const tab = t === "preparar" || t === "correo" || t === "etiquetas" ? t : "picking";
  return (
    <div className="space-y-6">
      {tab === "picking" && <Picking />}
      {tab === "preparar" && <Preparar />}
      {tab === "correo" && <CorreoTools />}
      {tab === "etiquetas" && <EtiquetasMl />}
    </div>
  );
}

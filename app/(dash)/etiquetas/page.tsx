import { redirect } from "next/navigation";

// La herramienta vive en /logistica (unificación 20/07); esta ruta queda por marcadores viejos.
export default function Page() {
  redirect("/logistica?t=etiquetas");
}

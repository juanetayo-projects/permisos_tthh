// Edge Function: permisos-recordar-soportes (cron)
//
// Le recuerda a diario a cada colaborador que tiene un soporte sin entregar.
//
// Por que existe:
//
//   Hasta ahora el aviso salia UNA vez, al aprobar la solicitud. El colaborador
//   volvia de la incapacidad o de la cita medica, se le olvidaba, y la solicitud
//   se quedaba en PENDIENTE_SOPORTE para siempre. Talento Humano lo descubria
//   semanas despues, al cerrar el mes de ausentismo.
//
// Que se recuerda:
//
//   Todo lo que este en PENDIENTE_SOPORTE, sea una incapacidad o una cita
//   medica. Y **no para al vencer el plazo**: pasado el limite el correo cambia
//   de tono a vencido y sigue saliendo. Un soporte que no llega no deja de
//   hacer falta porque se pase la fecha; dejar de insistir solo consigue que
//   nadie se entere.
//
//   SOPORTE_EN_VALIDACION queda fuera: ahi el archivo ya llego y la pelota la
//   tiene Talento Humano. Insistirle al colaborador por algo que ya hizo es la
//   forma mas rapida de que aprenda a ignorar estos correos.
//
// verify_jwt=true a proposito: la unica forma valida de invocarla es con un JWT
// de service_role, igual que `permisos-vencimientos`.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/** Una sola insistencia al dia, aunque el cron se dispare dos veces. */
const PLANTILLA = "recordatorio_soporte"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: pendientes, error } = await sb
    .from("permisos_solicitudes")
    .select("id, consecutivo")
    .eq("estado", "PENDIENTE_SOPORTE")
    .is("deleted_at", null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })
  }

  // A quien ya se le escribio hoy. Sin esto, un cron mal configurado —o un
  // reintento— le manda el mismo recordatorio dos y tres veces el mismo dia,
  // que es justo como se consigue que la gente marque el remitente como spam.
  const { data: yaAvisadas } = await sb
    .from("permisos_notificaciones")
    .select("solicitud_id")
    .eq("plantilla", PLANTILLA)
    .gte("enviado_en", `${hoy}T00:00:00Z`)

  const avisadas = new Set((yaAvisadas ?? []).map((n) => n.solicitud_id))
  const porAvisar = (pendientes ?? []).filter((s) => !avisadas.has(s.id))

  let enviados = 0
  const fallidos: string[] = []

  for (const s of porAvisar) {
    // En serie y no en paralelo: son decenas de correos como mucho, y Resend
    // limita por segundo. Un `Promise.all` sobre 80 solicitudes se come el
    // limite y falla la mitad sin dejar rastro de cual.
    const { error: errorEnvio } = await sb.functions.invoke("permisos-notificar", {
      body: { tipo: PLANTILLA, solicitud_id: s.id },
    })

    if (errorEnvio) fallidos.push(s.consecutivo ?? s.id)
    else enviados++
  }

  return new Response(
    JSON.stringify({
      ok: true,
      pendientes: pendientes?.length ?? 0,
      ya_avisadas_hoy: avisadas.size,
      enviados,
      fallidos,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  )
})

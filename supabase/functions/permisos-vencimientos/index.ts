// Edge Function: permisos-vencimientos (cron)
// Marca como VENCIDA cualquier solicitud que no recibio decision y cuya
// fecha de inicio ya paso. Pensada para invocarse una vez al dia desde
// GitHub Actions o cron-job.org, autenticada con la service_role key del
// proyecto (igual que las tareas programadas de las demas apps del cliente).
//
// verify_jwt=true a proposito: la unica forma valida de invocarla es con un
// JWT de service_role, que ya trae el poder para saltarse RLS. No se acepta
// ningun otro mecanismo de autenticacion.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const ESTADOS_PENDIENTES = ["PENDIENTE_COORDINADOR", "PENDIENTE_TH", "PENDIENTE_GERENCIA_TH"]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: vencidas, error } = await sb
    .from("permisos_solicitudes")
    .update({ estado: "VENCIDA" })
    .in("estado", ESTADOS_PENDIENTES)
    .lt("fecha_inicio", hoy)
    .is("deleted_at", null)
    .select("id, consecutivo, solicitante:permisos_perfiles(correo, nombre)")

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })

  // Alerta de coordinadores que llevan mas de N horas sin decidir (config).
  const { data: cfg } = await sb.from("permisos_config").select("valor").eq("clave", "escalar_coordinador_horas").maybeSingle()
  const horasEscalar = Number(cfg?.valor ?? 24)
  const limite = new Date(Date.now() - horasEscalar * 3600_000).toISOString()

  const { data: estancadas } = await sb
    .from("permisos_solicitudes")
    .select("id, consecutivo, enviada_en")
    .eq("estado", "PENDIENTE_COORDINADOR")
    .lt("enviada_en", limite)
    .is("deleted_at", null)

  return new Response(
    JSON.stringify({
      ok: true,
      vencidas: vencidas?.length ?? 0,
      estancadas_en_coordinador: estancadas?.length ?? 0,
    }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  )
})

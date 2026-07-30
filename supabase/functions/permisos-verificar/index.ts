// Edge Function: permisos-verificar (PUBLICA, sin JWT)
// Verifica la autenticidad de un documento a partir de su consecutivo y su
// codigo_verificacion (el QR impreso en el PDF). No requiere sesion porque
// cualquiera con el papel en la mano -o el QR- debe poder confirmarlo.
//
// El codigo_verificacion actua como capacidad: sin conocer las DOS piezas
// (consecutivo + codigo) no se puede consultar nada. Se devuelve el minimo
// indispensable, sin datos de salud ni justificaciones.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const url = new URL(req.url)
  const consecutivo = url.searchParams.get("c")?.trim()
  const codigo = url.searchParams.get("v")?.trim()

  if (!consecutivo || !codigo) return json({ valido: false, error: "Faltan datos de verificacion." }, 400)

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  const { data: s } = await sb
    .from("permisos_solicitudes")
    .select(`
      consecutivo, estado, fecha_inicio, fecha_fin, coord_fecha, th_fecha,
      tramite:permisos_tramites(nombre, codigo_formato, version_formato),
      solicitante:permisos_perfiles(nombre),
      area:areas(nombre)
    `)
    .eq("consecutivo", consecutivo)
    .eq("codigo_verificacion", codigo)
    .is("deleted_at", null)
    .maybeSingle()

  if (!s) return json({ valido: false, error: "No se encontro un documento con esos datos." }, 404)

  const tramite = Array.isArray(s.tramite) ? s.tramite[0] : s.tramite
  const solicitante = Array.isArray(s.solicitante) ? s.solicitante[0] : s.solicitante
  const area = Array.isArray(s.area) ? s.area[0] : s.area

  return json({
    valido: true,
    consecutivo: s.consecutivo,
    estado: s.estado,
    tramite: tramite?.nombre ?? null,
    formato: tramite ? `${tramite.codigo_formato} v${tramite.version_formato}` : null,
    solicitante: solicitante?.nombre ?? null,
    area: area?.nombre ?? null,
    fecha_inicio: s.fecha_inicio,
    fecha_fin: s.fecha_fin,
    autorizado_por_jefe: Boolean(s.coord_fecha),
    autorizado_por_th: Boolean(s.th_fecha),
  })
})

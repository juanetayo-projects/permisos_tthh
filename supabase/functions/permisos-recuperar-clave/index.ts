// Edge Function: permisos-recuperar-clave
// Envia el correo de recuperacion de contrasena de esta aplicacion.
//
// Por que no se usa `supabase.auth.resetPasswordForEmail` desde el navegador:
//
//   1. Con `flowType: 'pkce'` ese correo trae un enlace que pasa por
//      /auth/v1/verify y vuelve a la app con `?code=`. Ese codigo solo se
//      puede canjear en el MISMO navegador que pidio el cambio, porque el
//      `code_verifier` vive en su localStorage. Quien pide el cambio en el
//      computador y abre el correo en el celular ve "enlace no valido".
//   2. La plantilla de Auth la comparten Permisos y Cambio de Turnos, asi que
//      cambiarla para arreglar esta app romperia la otra.
//
// Aqui se genera el enlace con `generateLink` y se envia con Resend, igual que
// el resto de correos de la aplicacion. El enlace lleva `token_hash`, que la
// app canjea con `verifyOtp`: no depende de nada guardado en el navegador y
// por tanto funciona en cualquier dispositivo.
//
// Responde SIEMPRE `{ ok: true }`: decir si un correo existe o no convertiria
// esta pantalla en un directorio de quien trabaja en la clinica.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const APP_URL = Deno.env.get("APP_URL") ?? "https://juanetayo-projects.github.io/permisos_tthh/"
const BASE = APP_URL.replace(/\/$/, "")
const LOGO = BASE + "/images/logo_cacsb_blanc.png"
const AZUL = "#0D2D6B"
const AZUL2 = "#16468E"
const REMITENTE = "Talento Humano - CAC Santa Barbara <notificaciones@cacsantabarbara.co>"
const PLANTILLA = "recuperacion_clave"

/** Ventana minima entre dos correos al mismo destinatario. */
const ESPERA_MS = 60_000

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function plantilla(enlace: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(13,45,107,.1)">
        <tr><td style="background:linear-gradient(135deg,${AZUL},${AZUL2});padding:24px;text-align:center">
          <img src="${LOGO}" alt="Clinica Santa Barbara" height="46" style="display:inline-block"/>
          <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">Restablecer contrasena</div>
          <div style="color:#cdd9f0;font-size:13px">Permisos y Vacaciones - Talento Humano</div>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
          Hola,<br/><br/>
          Pediste restablecer la contrasena de tu cuenta. Pulsa el boton para elegir una nueva:
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${enlace}" style="background:${AZUL2};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Crear nueva contrasena</a>
          </div>
          <p style="font-size:13px;color:#64748b;margin-top:20px">
            Si el boton no funciona, copia y pega este enlace en tu navegador:<br/>
            <span style="word-break:break-all;color:${AZUL2}">${enlace}</span>
          </p>
          <div style="margin-top:22px;padding:12px;background:#fdf9ef;border-left:4px solid #b45309;border-radius:6px;font-size:13px">
            <b>Usa este correo si es el mas reciente.</b> Cada vez que se solicita un enlace nuevo,
            el anterior deja de funcionar. El enlace caduca en una hora y solo sirve una vez.
          </div>
          <p style="font-size:13px;color:#64748b;margin-top:18px">
            Si no fuiste tu, ignora este mensaje: tu contrasena actual sigue siendo valida.
          </p>
        </td></tr>
        <tr><td style="background:#f4f6fb;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
          Correo automatico del sistema de Permisos y Vacaciones.<br/>(c) ${new Date().getFullYear()} Clinica de Alta Complejidad Santa Barbara.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  const ok = () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })

  try {
    const { correo } = await req.json()
    const email = String(correo ?? "").trim().toLowerCase()
    if (!email.includes("@")) return ok()

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Sin este freno, un endpoint publico que dispara correos es un buen
    // vector para inundar la bandeja de cualquier colaborador.
    const { count } = await sb
      .from("permisos_notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("destinatario", email)
      .eq("plantilla", PLANTILLA)
      .gte("created_at", new Date(Date.now() - ESPERA_MS).toISOString())

    if (count && count > 0) return ok()

    const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email })
    const tokenHash = data?.properties?.hashed_token

    // Correo sin cuenta: se responde igual que si se hubiera enviado.
    if (error || !tokenHash) return ok()

    const enlace = `${BASE}/#/establecer-clave?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
    const asunto = "Restablece tu contrasena - Permisos y Vacaciones"

    const { data: apiKey } = await sb.rpc("get_secret", { p_name: "RESEND_API_KEY" })
    const RESEND_API_KEY = (apiKey as string) || Deno.env.get("RESEND_API_KEY") || ""
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY no disponible; no se envio la recuperacion.")
      return ok()
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMITENTE, to: email, subject: asunto, html: plantilla(enlace) }),
    })

    // El registro tambien es lo que sostiene el freno de arriba, asi que se
    // escribe tanto si Resend acepto como si no.
    await sb.from("permisos_notificaciones").insert({
      destinatario: email,
      plantilla: PLANTILLA,
      asunto,
      estado: res.ok ? "enviado" : "error",
      error: res.ok ? null : await res.text(),
      enviado_en: res.ok ? new Date().toISOString() : null,
    })

    return ok()
  } catch (e) {
    console.error("permisos-recuperar-clave:", String(e))
    return ok()
  }
})

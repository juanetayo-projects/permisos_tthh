// Edge Function: permisos-clave-usuario
// Lo que el modulo de Usuarios no puede hacer desde el navegador.
//
// Editar el perfil (area, cargo, jefe, telefono...) es un UPDATE normal y va
// por RLS desde el cliente. Aqui viven solo las tres operaciones que tocan
// `auth.users`, porque exigen la Admin API y su clave jamas puede viajar al
// navegador:
//
//   · definir_clave  — el administrador fija una contrasena. Es el caso de
//                      soporte: alguien perdio el acceso al correo con el que
//                      se registro y no puede recibir ningun enlace.
//   · enviar_enlace  — se le manda el correo para que la defina el mismo. Es
//                      la via normal y la unica en la que nadie mas que la
//                      persona llega a conocer su clave.
//   · cambiar_correo — un correo mal escrito deja la cuenta inservible: no
//                      entra el enlace de recuperacion ni las notificaciones.
//                      Cambiarlo solo en `permisos_perfiles` no sirve de nada,
//                      porque el inicio de sesion mira `auth.users`.
//
// Quien puede que:
//
//   · `definir_clave` es **solo del administrador**. Quien la fija la conoce,
//     asi que deja de haber un unico responsable de las acciones de esa cuenta
//     —y en este flujo las cuentas autorizan permisos—. Cuanta menos gente
//     pueda, mejor.
//   · Las otras dos las comparte con el analista de Talento Humano, que es
//     quien atiende a los colaboradores. Ninguna le revela una contrasena.
//
// Todo queda en `permisos_auditoria`, sin el valor de la clave.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const APP_URL = Deno.env.get("APP_URL") ?? "https://juanetayo-projects.github.io/permisos_tthh/"
const BASE = APP_URL.replace(/\/$/, "")
const LOGO = BASE + "/images/logo_cacsb_blanc.png"
const AZUL = "#0D2D6B"
const AZUL2 = "#16468E"
const REMITENTE = "Talento Humano - CAC Santa Barbara <notificaciones@cacsantabarbara.co>"

/** Mismo minimo que exige la pantalla de establecer clave. */
const MINIMO_CLAVE = 8

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })

function plantilla(nombre: string, enlace: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(13,45,107,.1)">
        <tr><td style="background:linear-gradient(135deg,${AZUL},${AZUL2});padding:24px;text-align:center">
          <img src="${LOGO}" alt="Clinica Santa Barbara" height="46" style="display:inline-block"/>
          <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">Define tu contrasena</div>
          <div style="color:#cdd9f0;font-size:13px">Permisos y Vacaciones - Talento Humano</div>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
          Hola <b>${nombre}</b>,<br/><br/>
          Talento Humano genero un enlace para que definas de nuevo tu contrasena
          de la aplicacion de Permisos y Vacaciones:
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${enlace}" style="background:${AZUL2};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Definir mi contrasena</a>
          </div>
          <p style="font-size:13px;color:#64748b;margin-top:20px">
            Si el boton no funciona, copia y pega este enlace en tu navegador:<br/>
            <span style="word-break:break-all;color:${AZUL2}">${enlace}</span>
          </p>
          <div style="margin-top:22px;padding:12px;background:#fdf9ef;border-left:4px solid #b45309;border-radius:6px;font-size:13px">
            <b>El enlace caduca en una hora.</b> Si no fuiste tu quien lo pidio, avisa a Talento
            Humano: mientras no lo abras, tu contrasena actual sigue funcionando.
          </div>
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

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // ---------------------------------------------------- Quien esta llamando
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    const { data: auth } = await sb.auth.getUser(token)
    const solicitante = auth?.user

    if (!solicitante) return responder({ error: "Sesion no valida." }, 401)

    const { data: quien } = await sb
      .from("permisos_perfiles")
      .select("rol, estado, nombre, correo")
      .eq("user_id", solicitante.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (!quien || quien.estado !== "activo") {
      return responder({ error: "Tu perfil no esta activo." }, 403)
    }

    const esAdmin = quien.rol === "administrador"
    const gestionaUsuarios = esAdmin || quien.rol === "analista_th"

    if (!gestionaUsuarios) {
      return responder({ error: "No tienes permiso para gestionar cuentas." }, 403)
    }

    // ------------------------------------------------------------- Los datos
    const cuerpo = await req.json()
    const accion = String(cuerpo.accion ?? "")
    const userId = String(cuerpo.user_id ?? "")

    if (!userId) return responder({ error: "Falta la persona." }, 400)

    const { data: destino } = await sb
      .from("permisos_perfiles")
      .select("user_id, nombre, correo, rol")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (!destino) return responder({ error: "Esa persona no tiene perfil activo." }, 404)

    const auditar = (accionAuditoria: string, motivo: string) =>
      sb.from("permisos_auditoria").insert({
        tabla: "auth.users",
        registro_id: userId,
        accion: "UPDATE",
        actor_id: solicitante.id,
        actor_correo: quien.correo,
        user_agent: req.headers.get("user-agent"),
        campos_cambiados: [accionAuditoria],
        motivo,
      })

    // ------------------------------------------------------- definir_clave
    if (accion === "definir_clave") {
      if (!esAdmin) {
        return responder(
          { error: "Solo el administrador puede fijar una contrasena. Usa «Enviar enlace»." },
          403
        )
      }

      const clave = String(cuerpo.clave ?? "")
      if (clave.length < MINIMO_CLAVE) {
        return responder({ error: `La contrasena necesita al menos ${MINIMO_CLAVE} caracteres.` }, 400)
      }

      const { error } = await sb.auth.admin.updateUserById(userId, { password: clave })
      if (error) {
        console.error("definir_clave:", error.message)
        return responder({ error: "No fue posible cambiar la contrasena." }, 500)
      }

      // El valor no se guarda en ningun sitio: en la auditoria solo consta que
      // se cambio, quien lo hizo y cuando.
      await auditar("password", `Contrasena definida por ${quien.nombre}`)

      return responder({ ok: true })
    }

    // ------------------------------------------------------- enviar_enlace
    if (accion === "enviar_enlace") {
      const { data: enlaceDatos, error } = await sb.auth.admin.generateLink({
        type: "recovery",
        email: destino.correo,
      })

      const tokenHash = enlaceDatos?.properties?.hashed_token
      if (error || !tokenHash) {
        console.error("enviar_enlace:", error?.message ?? "sin token")
        return responder({ error: "No fue posible generar el enlace." }, 500)
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""
      if (!RESEND_API_KEY) {
        return responder({ error: "Falta configurar RESEND_API_KEY: no sale ningun correo." }, 500)
      }

      const enlace = `${BASE}/#/establecer-clave?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      const asunto = "Define tu contrasena de Permisos y Vacaciones"

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: REMITENTE,
          to: destino.correo,
          subject: asunto,
          html: plantilla(destino.nombre, enlace),
        }),
      })

      if (!res.ok) console.error("Resend:", await res.text())

      await sb.from("permisos_notificaciones").insert({
        destinatario: destino.correo,
        plantilla: "restablecer_clave_admin",
        asunto,
        estado: res.ok ? "enviado" : "error",
        enviado_en: res.ok ? new Date().toISOString() : null,
      })

      await auditar("enlace_clave", `Enlace de contrasena enviado por ${quien.nombre}`)

      if (!res.ok) return responder({ error: "El correo no pudo enviarse." }, 502)
      return responder({ ok: true, correo_enviado: true })
    }

    // ------------------------------------------------------ cambiar_correo
    if (accion === "cambiar_correo") {
      const correo = String(cuerpo.correo ?? "").trim().toLowerCase()

      if (!correo.includes("@")) return responder({ error: "Ese correo no es valido." }, 400)
      if (correo === destino.correo.toLowerCase()) return responder({ ok: true, sin_cambios: true })

      // Se comprueba **antes** de tocar `auth.users`. Si se dejara al indice
      // unico de `permisos_perfiles` avisar, la cuenta se quedaria con el
      // correo nuevo y el perfil con el viejo: dos sitios que tienen que decir
      // lo mismo diciendo cosas distintas.
      const { data: ocupado } = await sb
        .from("permisos_perfiles")
        .select("user_id")
        .ilike("correo", correo)
        .is("deleted_at", null)
        .maybeSingle()

      if (ocupado) return responder({ error: "Ya hay un perfil con ese correo." }, 409)

      // `email_confirm` evita dejar la cuenta esperando una confirmacion que
      // nadie va a abrir: el cambio lo esta haciendo Talento Humano, no la
      // persona, y hasta confirmarlo no podria entrar.
      const { error } = await sb.auth.admin.updateUserById(userId, {
        email: correo,
        email_confirm: true,
      })

      if (error) {
        console.error("cambiar_correo:", error.message)
        const yaExiste = (error.message ?? "").toLowerCase().includes("already")
        return responder(
          { error: yaExiste ? "Ya hay una cuenta con ese correo." : "No fue posible cambiar el correo." },
          yaExiste ? 409 : 500
        )
      }

      const { error: errorPerfil } = await sb
        .from("permisos_perfiles")
        .update({ correo })
        .eq("user_id", userId)

      if (errorPerfil) {
        console.error("cambiar_correo perfil:", errorPerfil.message)
        return responder(
          { error: "El correo cambio en la cuenta pero no en el perfil. Avisa a soporte." },
          500
        )
      }

      await auditar("correo", `Correo cambiado de ${destino.correo} a ${correo} por ${quien.nombre}`)

      return responder({ ok: true })
    }

    return responder({ error: "Accion desconocida." }, 400)
  } catch (e) {
    console.error("permisos-clave-usuario:", String(e))
    return responder({ error: "No fue posible completar la operacion." }, 500)
  }
})

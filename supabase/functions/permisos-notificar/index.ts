// Edge Function: permisos-notificar
// Envia los correos del flujo BPM de Permisos y Vacaciones.
//
// tipos soportados:
//   'enviada'              -> confirmacion al solicitante + aviso al jefe directo
//                             (salvo cesantias e incapacidad, que van directas a TH)
//   'aprobada_coordinador' -> aviso al solicitante: paso a Talento Humano
//   'rechazada_coordinador'-> aviso al solicitante con el motivo
//   'pendiente_soporte'    -> aviso al solicitante: falta entregar el soporte
//   'recordatorio_soporte' -> insistencia diaria mientras el soporte no llegue
//   'soporte_devuelto'     -> aviso al solicitante: TH no dio el visto bueno al soporte
//   'finalizada'           -> aviso al solicitante con el sello de verificacion
//   'rechazada_th'         -> aviso al solicitante con el motivo (incluye cesantias)
//   'perfil_validado'      -> aviso al colaborador: ya puede solicitar
//
// Credenciales: RESEND_API_KEY en los secretos de este proyecto Supabase.
// El remitente es propio de esta app (no se reutiliza RESEND_FROM de la otra).
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const APP_URL = Deno.env.get("APP_URL") ?? "https://juanetayo-projects.github.io/permisos_tthh/"
const BASE = APP_URL.replace(/\/$/, "")
const LOGO = BASE + "/images/logo_cacsb_blanc.png"
const AZUL = "#0D2D6B"
const AZUL2 = "#16468E"
const VERDE = "#0F9D58"
const AMBAR = "#F4B400"
const ROJO = "#D93025"
const REMITENTE = "Talento Humano - CAC Santa Barbara <notificaciones@cacsantabarbara.co>"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function plantilla(titulo: string, cuerpo: string, boton?: { texto: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(13,45,107,.1)">
        <tr><td style="background:linear-gradient(135deg,${AZUL},${AZUL2});padding:24px;text-align:center">
          <img src="${LOGO}" alt="Clinica Santa Barbara" height="46" style="display:inline-block"/>
          <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">${titulo}</div>
          <div style="color:#cdd9f0;font-size:13px">Permisos y Vacaciones - Talento Humano</div>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">${cuerpo}
          ${boton ? `<div style="text-align:center;margin:28px 0 8px">
            <a href="${boton.url}" style="background:${AZUL2};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">${boton.texto}</a>
          </div>` : ""}
        </td></tr>
        <tr><td style="background:#f4f6fb;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
          Correo automatico del sistema de Permisos y Vacaciones.<br/>(c) ${new Date().getFullYear()} Clinica de Alta Complejidad Santa Barbara.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

const idChip = (id: string) =>
  `<div style="text-align:center;margin:0 0 20px">
     <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Consecutivo</div>
     <div style="display:inline-block;background:#E8EEF8;color:${AZUL};font-size:24px;font-weight:800;letter-spacing:1px;padding:10px 26px;border-radius:12px;border:1px solid #c9d8ef;margin-top:6px">${id}</div>
   </div>`

const estadoChip = (texto: string, bg: string) =>
  `<div style="text-align:center;margin:0 0 18px">
     <span style="display:inline-block;background:${bg};color:#fff;font-size:16px;font-weight:800;padding:9px 26px;border-radius:30px;letter-spacing:1px">${texto}</span>
   </div>`

function fila(label: string, valor: string | null | undefined) {
  return `<tr><td style="padding:4px 0;color:#64748b;width:170px">${label}</td><td style="padding:4px 0;font-weight:bold">${valor ?? "-"}</td></tr>`
}

function fechaCorta(iso?: string | null) {
  if (!iso) return null
  const [a, m, d] = iso.slice(0, 10).split("-")
  return `${d}/${m}/${a}`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    // `preview: true` devuelve el HTML sin enviar nada. Sirve para revisar el
    // diseño de las plantillas sin llenar de correos de prueba las bandejas
    // reales de coordinadores y colaboradores.
    const { tipo, solicitud_id, preview } = await req.json()
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // La clave vive en los secretos de este proyecto. Antes se leia tambien del
    // Vault de Cambio de Turnos con public.get_secret(), que no existe aqui.
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""

    const previsualizados: { destinatario: string; asunto: string; html: string }[] = []

    async function enviar(to: string | null | undefined, subject: string, html: string) {
      if (!to) return
      if (preview) {
        previsualizados.push({ destinatario: to, asunto: subject, html })
        return
      }
      if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY no disponible; correo omitido."); return }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: REMITENTE, to, subject, html }),
      })
      if (!res.ok) console.error("Resend error:", await res.text())
      else await sb.from("permisos_notificaciones").insert({
        solicitud_id, destinatario: to, plantilla: tipo, asunto: subject, estado: "enviado", enviado_en: new Date().toISOString(),
      })
    }

    const { data: s, error } = await sb
      .from("permisos_solicitudes")
      .select(`
        id, consecutivo, codigo_verificacion, fecha_inicio, fecha_fin, motivo_rechazo, coordinador_id,
        tramite:permisos_tramites(nombre, codigo),
        solicitante:permisos_perfiles(nombre, correo, coordinador_id),
        area:areas(nombre),
        detalle_permiso:permisos_detalle_permiso(dias_permiso, horas_permiso, requiere_soporte_posterior, fecha_limite_soporte,
          tipo:permisos_tipos(nombre, ruta_aprobacion)),
        detalle_vacaciones:permisos_detalle_vacaciones(dias_a_disfrutar, fecha_reintegro)
      `)
      .eq("id", solicitud_id)
      .single()

    if (error || !s) return new Response(JSON.stringify({ error: "Solicitud no encontrada" }), { status: 404, headers: cors })

    const detallePermiso = Array.isArray(s.detalle_permiso) ? s.detalle_permiso[0] : s.detalle_permiso
    const detalleVacaciones = Array.isArray(s.detalle_vacaciones) ? s.detalle_vacaciones[0] : s.detalle_vacaciones
    const solicitante = Array.isArray(s.solicitante) ? s.solicitante[0] : s.solicitante
    const tramite = Array.isArray(s.tramite) ? s.tramite[0] : s.tramite
    const area = Array.isArray(s.area) ? s.area[0] : s.area
    const tipoMotivo = Array.isArray(detallePermiso?.tipo) ? detallePermiso?.tipo[0] : detallePermiso?.tipo

    const id = s.consecutivo ?? `#${s.id.slice(0, 8)}`
    const esVacaciones = tramite?.codigo === "vacaciones"
    const nombreMotivo = esVacaciones ? "Vacaciones" : (tipoMotivo?.nombre ?? "Permiso")

    // El jefe directo es el ELEGIDO en la solicitud, no el del perfil: quien
    // cambio de servicio deja el perfil desactualizado y el correo llegaria al
    // jefe anterior. El perfil solo sirve de respaldo para datos antiguos.
    const coordinadorId = s.coordinador_id ?? solicitante?.coordinador_id ?? null
    let coordCorreo: string | null = null
    let coordNombre = ""
    if (coordinadorId) {
      const { data: coord } = await sb.from("coordinadores").select("nombre, correo").eq("id", coordinadorId).maybeSingle()
      coordCorreo = (coord?.correo as string) ?? null
      coordNombre = (coord?.nombre as string) ?? ""
    }

    const resumen = `<table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin-top:10px">
      ${fila("Solicitante", solicitante?.nombre)}
      ${fila("Area", area?.nombre)}
      ${fila("Tramite", nombreMotivo)}
      ${fila("Periodo", `${fechaCorta(s.fecha_inicio)}${s.fecha_fin !== s.fecha_inicio ? ` a ${fechaCorta(s.fecha_fin)}` : ""}`)}
    </table>`

    const urlApp = `${BASE}/#/mis-solicitudes`
    const esCesantia = tipoMotivo?.ruta_aprobacion === "gerente_th_directo"
    // La incapacidad tambien salta al jefe directo, pero por otro motivo: la
    // acaba de radicar el, no tiene sentido pedirle que se autorice a si mismo.
    // Antes solo se comprobaba `esCesantia`, y una incapacidad colaba al jefe
    // un correo pidiendole "autorizar" algo que ya estaba en Talento Humano.
    const esIncapacidad = tramite?.codigo === "incapacidad"
    const vaDirectoATH = esCesantia || esIncapacidad

    switch (tipo) {
      case "enviada": {
        await enviar(solicitante?.correo, `Solicitud ${id} registrada`,
          plantilla("Solicitud registrada",
            `${idChip(id)}Hola <b>${solicitante?.nombre ?? ""}</b>,<br/><br/>
             ${esIncapacidad
               ? `Tu jefe directo reporto una incapacidad a tu nombre.`
               : `Tu solicitud de <b>${nombreMotivo}</b> fue registrada correctamente.`}
             ${vaDirectoATH ? "Un miembro de la Direccion de Talento Humano la revisara directamente." : `Quedo en la bandeja de tu jefe directo${coordNombre ? ` <b>${coordNombre}</b>` : ""} para su autorizacion.`}
             ${resumen}`,
            { texto: "Ver mis solicitudes", url: urlApp }))

        if (!vaDirectoATH && coordCorreo) {
          await enviar(coordCorreo, `Nueva solicitud por autorizar ${id}`,
            plantilla("Solicitud pendiente de tu autorizacion",
              `${idChip(id)}Hola${coordNombre ? ` <b>${coordNombre}</b>` : ""},<br/><br/>
               <b>${solicitante?.nombre}</b> registro una solicitud de <b>${nombreMotivo}</b> que requiere tu autorizacion como jefe directo.${resumen}`,
              { texto: "Ir a mi bandeja", url: `${BASE}/#/bandeja/coordinador` }))
        }
        break
      }

      case "aprobada_coordinador": {
        await enviar(solicitante?.correo, `Tu solicitud ${id} fue autorizada`,
          plantilla("Autorizada por tu jefe directo",
            `${idChip(id)}${estadoChip("AUTORIZADA", VERDE)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             Tu jefe directo autorizo tu solicitud de <b>${nombreMotivo}</b>. Ahora pasa a Talento Humano para el visto bueno final.${resumen}`,
            { texto: "Ver estado", url: urlApp }))
        break
      }

      case "rechazada_coordinador":
      case "rechazada_th": {
        const quien = tipo === "rechazada_coordinador" ? "tu jefe directo" : "Talento Humano"
        await enviar(solicitante?.correo, `Tu solicitud ${id} fue rechazada`,
          plantilla("Solicitud rechazada",
            `${idChip(id)}${estadoChip("RECHAZADA", ROJO)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             ${quien} rechazo tu solicitud de <b>${nombreMotivo}</b>.
             ${s.motivo_rechazo ? `<div style="margin-top:14px;padding:12px;background:#f4f6fb;border-left:4px solid ${ROJO};border-radius:6px"><b>Motivo:</b><br/>${s.motivo_rechazo}</div>` : ""}
             ${resumen}`,
            { texto: "Ver detalle", url: urlApp }))
        break
      }

      case "pendiente_soporte": {
        await enviar(solicitante?.correo, `Debes adjuntar el soporte de ${id}`,
          plantilla("Falta tu soporte",
            `${idChip(id)}${estadoChip("PENDIENTE DE SOPORTE", AMBAR)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             Tu solicitud de <b>${nombreMotivo}</b> ya fue aprobada, pero debes adjuntar el soporte correspondiente
             ${detallePermiso?.fecha_limite_soporte ? `antes del <b>${fechaCorta(detallePermiso.fecha_limite_soporte)}</b>` : "lo antes posible"}.${resumen}`,
            { texto: "Adjuntar soporte", url: urlApp }))
        break
      }

      // Se repite a diario mientras el soporte no llegue. Va aparte de
      // `pendiente_soporte` —que sale una sola vez, al aprobar— para que en
      // `permisos_notificaciones` se distinga el aviso del recordatorio: con
      // una sola plantilla no habria forma de saber cuantas veces se insistio.
      case "recordatorio_soporte": {
        const limite = detallePermiso?.fecha_limite_soporte
        const vencido = limite ? limite < new Date().toISOString().slice(0, 10) : false

        await enviar(solicitante?.correo,
          vencido ? `Vencido: falta el soporte de ${id}` : `Recordatorio: falta el soporte de ${id}`,
          plantilla(vencido ? "El plazo del soporte ya vencio" : "Todavia falta tu soporte",
            `${idChip(id)}${estadoChip(vencido ? "PLAZO VENCIDO" : "PENDIENTE DE SOPORTE", vencido ? ROJO : AMBAR)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             ${vencido
               ? `El plazo para adjuntar el soporte de tu <b>${nombreMotivo}</b> vencio el <b>${fechaCorta(limite)}</b> y todavia no lo hemos recibido. Cargalo cuanto antes: mientras no llegue, la solicitud no se puede cerrar.`
               : `Tu solicitud de <b>${nombreMotivo}</b> sigue esperando el soporte${limite ? `, que debe llegar antes del <b>${fechaCorta(limite)}</b>` : ""}.`}
             ${resumen}`,
            { texto: "Adjuntar soporte", url: urlApp }))
        break
      }

      // Talento Humano devolvio el soporte. El motivo NO se copia en el correo
      // a proposito: puede describir una condicion de salud, y este correo sale
      // a una cuenta que en muchos casos es personal. Se le manda a leerlo
      // dentro de la aplicacion, que es donde el dato esta protegido.
      case "soporte_devuelto": {
        await enviar(solicitante?.correo, `Tu soporte de ${id} no fue aceptado`,
          plantilla("El soporte no tiene el visto bueno",
            `${idChip(id)}${estadoChip("SOPORTE DEVUELTO", ROJO)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             Talento Humano reviso el soporte que adjuntaste a tu <b>${nombreMotivo}</b> y <b>no le dio el visto bueno</b>.
             Entra a la solicitud y lee las observaciones del rechazo: ahi te indican que hace falta para poder cargar uno nuevo.
             ${resumen}`,
            { texto: "Ver las observaciones", url: urlApp }))
        break
      }

      case "finalizada": {
        const urlVerificar = `${BASE}/#/verificar?c=${encodeURIComponent(s.consecutivo ?? "")}&v=${encodeURIComponent(s.codigo_verificacion ?? "")}`
        await enviar(solicitante?.correo, `Tu solicitud ${id} quedo finalizada`,
          plantilla("Solicitud finalizada",
            `${idChip(id)}${estadoChip("FINALIZADA", VERDE)}Hola <b>${solicitante?.nombre}</b>,<br/><br/>
             Tu solicitud de <b>${nombreMotivo}</b> quedo aprobada y archivada.
             ${esVacaciones && detalleVacaciones?.fecha_reintegro ? `Recuerda presentarte a laborar el <b>${fechaCorta(detalleVacaciones.fecha_reintegro)}</b>.` : ""}${resumen}
             <p style="margin-top:16px;font-size:12px;color:#64748b">Puedes verificar la autenticidad de este documento en el siguiente enlace.</p>`,
            { texto: "Verificar documento", url: urlVerificar }))
        break
      }

      case "perfil_validado": {
        await enviar(solicitante?.correo, "Tu cuenta ya esta habilitada",
          plantilla("Cuenta habilitada",
            `Hola <b>${solicitante?.nombre ?? ""}</b>,<br/><br/>
             Talento Humano valido tus datos. Ya puedes iniciar sesion y registrar tus solicitudes de permisos y vacaciones.`,
            { texto: "Ingresar", url: `${BASE}/#/login` }))
        break
      }
    }

    return new Response(
      JSON.stringify(preview ? { ok: true, preview: previsualizados } : { ok: true }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})

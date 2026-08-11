// Edge Function: permisos-crear-usuario
// Alta de un colaborador desde la consola de administracion.
//
// Por que hace falta una funcion y no basta con el cliente:
//
//   Crear una cuenta en `auth.users` exige la Admin API, que solo funciona con
//   la service role key. Esa clave jamas puede viajar al navegador, asi que la
//   operacion vive aqui.
//
// Quien puede llamarla se comprueba **en el servidor**, no en la interfaz:
//
//   - Talento Humano y administracion pueden dar de alta colaboradores.
//   - Solo el administrador puede crear cuentas con otro rol. Sin esta linea,
//     un analista podria fabricarse un administrador y saltarse la separacion
//     de funciones que sostiene todo el flujo de aprobaciones.
//
// La contrasena no la elige quien crea la cuenta: se manda un enlace para que
// la persona la defina. Asi nadie mas que ella la conoce, y de paso el enlace
// sirve de correo de bienvenida.
//
// Acepta dos formas de payload en el mismo endpoint:
//   - Un solo usuario: los campos de siempre (correo, nombre, rol, ...).
//   - Un lote: `{ usuarios: [...] }`, para la carga masiva desde Excel. Se
//     procesa fila por fila -cada una puede fallar por su cuenta, por ejemplo
//     un correo repetido- y se devuelve un resultado por fila en vez de
//     abortar el lote completo por un solo error.
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2"

const APP_URL = Deno.env.get("APP_URL") ?? "https://juanetayo-projects.github.io/permisos_tthh/"
const BASE = APP_URL.replace(/\/$/, "")
const LOGO = BASE + "/images/logo_cacsb_blanc.png"
const AZUL = "#0D2D6B"
const AZUL2 = "#16468E"
const REMITENTE = "Talento Humano - CAC Santa Barbara <notificaciones@cacsantabarbara.co>"

const ROLES_VALIDOS = [
  "colaborador",
  "coordinador",
  "coordinador_sst",
  "analista_th",
  "gerente_th",
  "administrador",
]
/** Quienes pueden dar de alta a alguien. */
const PUEDEN_CREAR = ["administrador", "analista_th", "gerente_th"]

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
          <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">Te damos la bienvenida</div>
          <div style="color:#cdd9f0;font-size:13px">Permisos y Vacaciones - Talento Humano</div>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
          Hola <b>${nombre}</b>,<br/><br/>
          Talento Humano te creo una cuenta en la aplicacion de Permisos y Vacaciones de la
          clinica. Define tu contrasena para entrar:
          <div style="text-align:center;margin:28px 0 8px">
            <a href="${enlace}" style="background:${AZUL2};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Definir mi contrasena</a>
          </div>
          <p style="font-size:13px;color:#64748b;margin-top:20px">
            Si el boton no funciona, copia y pega este enlace en tu navegador:<br/>
            <span style="word-break:break-all;color:${AZUL2}">${enlace}</span>
          </p>
          <div style="margin-top:22px;padding:12px;background:#fdf9ef;border-left:4px solid #b45309;border-radius:6px;font-size:13px">
            <b>El enlace caduca en una hora.</b> Si se te pasa, usa "Olvide mi contrasena" en la
            pantalla de ingreso con este mismo correo.
          </div>
        </td></tr>
        <tr><td style="background:#f4f6fb;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
          Correo automatico del sistema de Permisos y Vacaciones.<br/>(c) ${new Date().getFullYear()} Clinica de Alta Complejidad Santa Barbara.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

interface ResultadoFila {
  ok: boolean
  user_id?: string
  ya_existia?: boolean
  correo_enviado?: boolean
  error?: string
}

/**
 * Da de alta a una persona. Es la misma lógica que antes tenía el handler
 * directamente, extraída para poder llamarla una vez (un solo usuario) o en
 * bucle (el lote de la carga masiva) sin duplicar nada.
 */
async function crearUno(
  sb: SupabaseClient,
  solicitanteId: string,
  puedeAsignarRol: boolean,
  cuerpo: Record<string, unknown>
): Promise<ResultadoFila> {
  const correo = String(cuerpo.correo ?? "").trim().toLowerCase()
  const nombre = String(cuerpo.nombre ?? "").trim()
  const rol = String(cuerpo.rol ?? "colaborador")

  if (!correo.includes("@") || !nombre) {
    return { ok: false, error: "Hacen falta el nombre y un correo valido." }
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return { ok: false, error: "Rol desconocido." }
  }
  // La comprobacion que impide que un analista se fabrique un administrador.
  if (rol !== "colaborador" && !puedeAsignarRol) {
    return { ok: false, error: "Solo el administrador puede asignar un rol distinto de colaborador." }
  }

  // ------------------------------------------------- La cuenta de auth
  // El correo puede existir ya: alguien pudo registrarse por su cuenta y
  // quedar sin perfil. En ese caso se reutiliza la cuenta en vez de fallar.
  let userId: string | null = null
  let yaExistia = false

  const { data: creado, error: errorCrear } = await sb.auth.admin.createUser({
    email: correo,
    email_confirm: true,
    user_metadata: { nombre, app: "permisos_tthh" },
  })

  if (creado?.user) {
    userId = creado.user.id
  } else {
    const mensaje = (errorCrear?.message ?? "").toLowerCase()
    if (!mensaje.includes("already") && !mensaje.includes("registered")) {
      return { ok: false, error: "No fue posible crear la cuenta." }
    }

    // `listUsers` no filtra por correo. Antes se buscaba en `profiles`, la
    // tabla de Cambio de Turnos, que ya no existe en este proyecto:
    // `generateLink` devuelve el usuario y de paso sirve para el correo.
    const { data: existente } = await sb.auth.admin.generateLink({
      type: "recovery",
      email: correo,
    })

    userId = existente?.user?.id ?? null
    yaExistia = true

    if (!userId) {
      return { ok: false, error: "Ese correo ya tiene una cuenta, pero no fue posible ubicarla." }
    }
  }

  // ------------------------------------------------------------- El perfil
  const { data: perfilPrevio } = await sb
    .from("permisos_perfiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle()

  if (perfilPrevio) {
    return { ok: false, error: "Esa persona ya tiene perfil en la aplicacion." }
  }

  const { error: errorPerfil } = await sb.from("permisos_perfiles").insert({
    user_id: userId,
    nombre,
    correo,
    tipo_documento: cuerpo.tipo_documento ?? "CC",
    documento: cuerpo.documento ? String(cuerpo.documento).trim() : null,
    telefono: cuerpo.telefono ? String(cuerpo.telefono).trim() : null,
    empresa_id: cuerpo.empresa_id ?? null,
    area_id: cuerpo.area_id ?? null,
    cargo_id: cuerpo.cargo_id ?? null,
    coordinador_id: cuerpo.coordinador_id ?? null,
    rol,
    // Nace activa: la creo Talento Humano, que es justo quien valida. Pasar
    // por «pendiente de validacion» seria pedirle que se valide a si misma,
    // y ese es el cuello de botella que este alta viene a quitar.
    estado: "activo",
    activo: true,
    validado_por: solicitanteId,
    validado_en: new Date().toISOString(),
  })

  if (errorPerfil) {
    console.error("perfil:", errorPerfil.message)
    return { ok: false, error: "La cuenta se creo pero el perfil no. Revisa en Usuarios." }
  }

  // --------------------------------------------- Correo para poner la clave
  let correoEnviado = false

  const { data: enlaceDatos } = await sb.auth.admin.generateLink({
    type: "recovery",
    email: correo,
  })
  const tokenHash = enlaceDatos?.properties?.hashed_token

  if (tokenHash) {
    // La clave vive en los secretos de este proyecto. Antes se leia tambien del
    // Vault de Cambio de Turnos con public.get_secret(), que no existe aqui.
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""

    if (RESEND_API_KEY) {
      const enlace = `${BASE}/#/establecer-clave?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`
      const asunto = "Tu cuenta de Permisos y Vacaciones"

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: REMITENTE,
          to: correo,
          subject: asunto,
          html: plantilla(nombre, enlace),
        }),
      })

      correoEnviado = res.ok
      if (!res.ok) console.error("Resend:", await res.text())

      await sb.from("permisos_notificaciones").insert({
        destinatario: correo,
        plantilla: "bienvenida_alta",
        asunto,
        estado: res.ok ? "enviado" : "error",
        enviado_en: res.ok ? new Date().toISOString() : null,
      })
    }
  }

  // El alta es correcta aunque el correo falle: la persona siempre puede
  // usar «Olvide mi contrasena». Se devuelve para poder avisarlo en pantalla.
  return { ok: true, user_id: userId, ya_existia: yaExistia, correo_enviado: correoEnviado }
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

    const { data: perfilSolicitante } = await sb
      .from("permisos_perfiles")
      .select("rol, estado, nombre")
      .eq("user_id", solicitante.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (
      !perfilSolicitante ||
      perfilSolicitante.estado !== "activo" ||
      !PUEDEN_CREAR.includes(perfilSolicitante.rol)
    ) {
      return responder({ error: "No tienes permiso para crear usuarios." }, 403)
    }

    const puedeAsignarRol = perfilSolicitante.rol === "administrador"
    const cuerpo = await req.json()

    // ------------------------------------------------------------ El lote
    if (Array.isArray(cuerpo.usuarios)) {
      const filas = cuerpo.usuarios as Record<string, unknown>[]
      if (filas.length === 0) {
        return responder({ error: "El archivo no trae filas para importar." }, 400)
      }
      if (filas.length > 500) {
        return responder({ error: "Máximo 500 filas por carga: divide el archivo." }, 400)
      }

      const resultados: ResultadoFila[] = []
      // Secuencial, no en paralelo: cada alta manda un correo por Resend, y
      // el proveedor limita cuántos se envían por segundo.
      for (const fila of filas) {
        resultados.push(await crearUno(sb, solicitante.id, puedeAsignarRol, fila))
      }

      return responder({ resultados })
    }

    // --------------------------------------------------------- Un solo usuario
    const resultado = await crearUno(sb, solicitante.id, puedeAsignarRol, cuerpo)
    if (!resultado.ok) {
      const status = resultado.error?.includes("ya tiene") ? 409 : 400
      return responder({ error: resultado.error }, status)
    }

    return responder({
      ok: true,
      user_id: resultado.user_id,
      ya_existia: resultado.ya_existia,
      correo_enviado: resultado.correo_enviado,
    })
  } catch (e) {
    console.error("permisos-crear-usuario:", String(e))
    return responder({ error: "No fue posible completar el alta." }, 500)
  }
})

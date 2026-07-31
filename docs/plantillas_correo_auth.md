# Plantillas de correo de Supabase Auth

Los correos de **confirmación de cuenta** y **recuperación de contraseña** no
los envía la aplicación: los genera Supabase Auth con sus plantillas por
defecto, que son texto plano sin ningún diseño. Por eso el correo de registro
llegaba sin formato aunque el resto de notificaciones sí lo tienen.

Estas plantillas hay que pegarlas **una sola vez** en el panel de Supabase.

> ⚠️ Estas plantillas son del proyecto compartido con Cambio de Turnos. Al
> cambiarlas, **también cambian los correos de esa aplicación**. Por eso el
> texto es neutro —«sistema de gestión de la clínica»— y no menciona Permisos.

## Dónde pegarlas

**Authentication → Emails** (sección *NOTIFICATIONS* del menú lateral)

Enlace directo:
https://supabase.com/dashboard/project/rykondrasrvnuurolqqk/auth/templates

Cada plantilla tiene su pestaña. Reemplaza el contenido del campo *Message body*
y guarda.

---

## 1. Confirm signup — confirmación de cuenta

**Subject:** `Confirma tu cuenta · Clínica CAC Santa Bárbara`

```html
<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(13,45,107,.1)">
      <tr><td style="background:linear-gradient(135deg,#0D2D6B,#16468E);padding:24px;text-align:center">
        <img src="https://juanetayo-projects.github.io/permisos_tthh/images/logo_cacsb_blanc.png" alt="Clínica CAC Santa Bárbara" height="46" style="display:inline-block"/>
        <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">Confirma tu cuenta</div>
        <div style="color:#cdd9f0;font-size:13px">Clínica de Alta Complejidad Santa Bárbara</div>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
        Hola,<br/><br/>
        Recibimos una solicitud para crear una cuenta con este correo en el sistema de gestión de la Clínica.
        Confirma que fuiste tú pulsando el botón:
        <div style="text-align:center;margin:28px 0 8px">
          <a href="{{ .ConfirmationURL }}" style="background:#16468E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Confirmar mi cuenta</a>
        </div>
        <p style="font-size:13px;color:#64748b;margin-top:20px">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
          <span style="word-break:break-all;color:#16468E">{{ .ConfirmationURL }}</span>
        </p>
        <div style="margin-top:22px;padding:12px;background:#f2f6fd;border-left:4px solid #16468E;border-radius:6px;font-size:13px">
          Después de confirmar, <b>Talento Humano validará tus datos</b> antes de habilitarte.
          Recibirás un aviso cuando puedas empezar a registrar solicitudes.
        </div>
        <p style="font-size:13px;color:#64748b;margin-top:18px">
          Si no solicitaste esta cuenta, puedes ignorar este mensaje: no se creará nada.
        </p>
      </td></tr>
      <tr><td style="background:#f4f6fb;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
        Correo automático. Por favor no respondas a esta dirección.<br/>
        © Clínica de Alta Complejidad Santa Bárbara
      </td></tr>
    </table>
  </td></tr>
</table></body></html>
```

---

## 2. Reset password — recuperación de contraseña

> ℹ️ **Permisos ya no usa esta plantilla.** Desde el 2026-07-31 su correo de
> recuperación lo envía la Edge Function `permisos-recuperar-clave` por Resend,
> porque el enlace de esta plantilla **solo funciona en el mismo navegador** que
> pidió el cambio (flujo PKCE), y quien pide el cambio en el computador suele
> abrir el correo en el celular. Como la plantilla la comparte Cambio de Turnos,
> no se podía arreglar aquí sin romper esa aplicación.
>
> Sigue haciendo falta pegarla **para Cambio de Turnos**, que sí la usa. Y esa
> aplicación arrastra la misma limitación del mismo navegador: si algún día se
> quiere corregir, el camino es el mismo que se siguió en Permisos.

**Subject:** `Restablece tu contraseña · Clínica CAC Santa Bárbara`

```html
<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(13,45,107,.1)">
      <tr><td style="background:linear-gradient(135deg,#0D2D6B,#16468E);padding:24px;text-align:center">
        <img src="https://juanetayo-projects.github.io/permisos_tthh/images/logo_cacsb_blanc.png" alt="Clínica CAC Santa Bárbara" height="46" style="display:inline-block"/>
        <div style="color:#fff;font-size:18px;font-weight:bold;margin-top:12px">Restablecer contraseña</div>
        <div style="color:#cdd9f0;font-size:13px">Clínica de Alta Complejidad Santa Bárbara</div>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6">
        Hola,<br/><br/>
        Pediste restablecer la contraseña de tu cuenta. Pulsa el botón para elegir una nueva:
        <div style="text-align:center;margin:28px 0 8px">
          <a href="{{ .ConfirmationURL }}" style="background:#16468E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">Crear nueva contraseña</a>
        </div>
        <p style="font-size:13px;color:#64748b;margin-top:20px">
          Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
          <span style="word-break:break-all;color:#16468E">{{ .ConfirmationURL }}</span>
        </p>
        <div style="margin-top:22px;padding:12px;background:#fdf9ef;border-left:4px solid #b45309;border-radius:6px;font-size:13px">
          <b>El enlace caduca en una hora.</b> Si no lo usas a tiempo, solicita uno nuevo desde la aplicación.
        </div>
        <p style="font-size:13px;color:#64748b;margin-top:18px">
          Si no fuiste tú, ignora este mensaje: tu contraseña actual sigue siendo válida.
        </p>
      </td></tr>
      <tr><td style="background:#f4f6fb;padding:16px;text-align:center;font-size:11px;color:#94a3b8">
        Correo automático. Por favor no respondas a esta dirección.<br/>
        © Clínica de Alta Complejidad Santa Bárbara
      </td></tr>
    </table>
  </td></tr>
</table></body></html>
```

---

## 3. Magic Link e Invite

No se usan en esta aplicación. Si en el futuro Talento Humano invita
colaboradores desde el panel de Supabase, conviene copiar la plantilla de
confirmación cambiando el titular por «Te damos la bienvenida».

## Nota sobre el remitente

Estos correos salen por el SMTP configurado en el proyecto, **no por Resend**.
Si el remitente aparece como `noreply@mail.app.supabase.io`, hay que configurar
SMTP propio en **Project Settings → Authentication → SMTP Settings** apuntando a
Resend, para que también estos salgan desde `notificaciones@cacsantabarbara.co`.

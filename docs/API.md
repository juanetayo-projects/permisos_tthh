# API

No hay API propia: el cliente habla directamente con PostgREST y las policies
deciden qué devuelve. Lo que necesita privilegios va en Edge Functions.

Base: `https://rykondrasrvnuurolqqk.supabase.co`

## Edge Functions

### `permisos-notificar`

Envía los correos del flujo por Resend. Requiere JWT.

```http
POST /functions/v1/permisos-notificar
{ "tipo": "enviada", "solicitud_id": "uuid", "preview": false }
```

| `tipo` | Destinatarios |
|---|---|
| `enviada` | Solicitante + jefe directo (o solo gerencia si es cesantía) |
| `aprobada_coordinador` | Solicitante |
| `rechazada_coordinador` | Solicitante, con el motivo |
| `pendiente_soporte` | Solicitante, con la fecha límite |
| `finalizada` | Solicitante, con el enlace de verificación |
| `rechazada_th` | Solicitante, con el motivo |
| `perfil_validado` | Colaborador recién habilitado |

**`preview: true` devuelve el HTML sin enviar nada.** Sirve para revisar
plantillas sin llenar de correos de prueba las bandejas reales:

```json
{ "ok": true, "preview": [{ "destinatario": "…", "asunto": "…", "html": "…" }] }
```

El jefe directo se toma de `solicitudes.coordinador_id`, no del perfil: quien
cambió de servicio tiene el perfil desactualizado.

Los enlaces se construyen sobre `APP_URL`, que por defecto apunta a la versión
publicada en GitHub Pages.

### `permisos-verificar`

**Pública, sin JWT.** Destino del QR impreso en cada PDF.

```http
GET /functions/v1/permisos-verificar?c=PL-2026-00001&v=95d7da486f1e8f25f4
```

```json
{
  "valido": true,
  "consecutivo": "PL-2026-00001",
  "estado": "FINALIZADA",
  "tramite": "Autorización de permiso laboral",
  "formato": "TH-F-002 v02",
  "solicitante": "Juan Carlos Etayo",
  "area": "Sistemas de información",
  "fecha_inicio": "2026-08-04",
  "fecha_fin": "2026-08-04",
  "autorizado_por_jefe": true,
  "autorizado_por_th": true
}
```

Con datos incorrectos devuelve `{ "valido": false, "error": "…" }`. Nunca revela
justificación, observaciones ni soportes.

### `permisos-vencimientos`

Marca `VENCIDA` toda solicitud cuya fecha pasó sin decisión del jefe directo.
Pensada para un cron diario, autenticada con `service_role`.

## Funciones de base de datos

Se llaman por RPC desde el cliente.

| Función | Quién | Para qué |
|---|---|---|
| `permisos_catalogos_registro()` | `anon` | Empresas, áreas y cargos del formulario de registro |
| `permisos_rol()` | `authenticated` | Rol del usuario actual |
| `permisos_es_admin()`, `permisos_es_th()`, `permisos_es_gerente_th()` | `authenticated` | Predicados de RLS |
| `permisos_es_jefe_de(coordinador_id, area_id)` | `authenticated` | Si el usuario puede decidir sobre esa solicitud |
| `permisos_coordinador_ids()` | `authenticated` | IDs de coordinador que le corresponden, por correo |
| `permisos_areas_coordinadas()` | `authenticated` | Áreas que coordina |
| `permisos_perfil_activo()` | `authenticated` | Si ya pasó la validación de TH |

Todas son `SECURITY DEFINER` con `search_path` acotado a `public`.

## Consultas típicas

Las policies filtran; el cliente no añade condiciones de seguridad.

```ts
// Bandeja: solo devuelve lo que el usuario puede ver
const { data } = await supabase
  .from('permisos_solicitudes')
  .select(`
    id, consecutivo, estado, fecha_inicio, fecha_fin,
    tramite:permisos_tramites(codigo, nombre),
    solicitante:permisos_perfiles(nombre, documento),
    area:areas(nombre),
    detalle_permiso:permisos_detalle_permiso(horas_permiso, tipo:permisos_tipos(nombre)),
    detalle_vacaciones:permisos_detalle_vacaciones(dias_a_disfrutar)
  `)
  .in('estado', ['PENDIENTE_COORDINADOR'])
  .is('deleted_at', null)
```

Los alias evitan que PostgREST tenga que adivinar la relación y hacen el
consumo legible en React.

```ts
// Soporte: URL firmada de 60 segundos, por tratarse de datos de salud
const { data } = await supabase.storage
  .from('soportes-permisos')
  .createSignedUrl(ruta, 60)
```

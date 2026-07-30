# Base de datos

Proyecto Supabase `rykondrasrvnuurolqqk` (`cambiodeturnos`), Postgres 17.
Ver el diagrama en [ERD.md](ERD.md) y las policies en [SECURITY.md](SECURITY.md).

## Tablas propias

### Catálogos

| Tabla | Contenido |
|---|---|
| `permisos_empresas` | CAC Santa Bárbara, GE2, Geriater |
| `permisos_tramites` | Los dos formatos, con código, versión y antelación mínima |
| `permisos_categorias` | Las cinco casillas del TH-F-002 |
| `permisos_tipos` | Motivos, con reglas de soporte y ruta de aprobación |
| `permisos_config` | Parámetros editables sin desplegar |

### Personas

`permisos_perfiles` — uno por usuario de `auth.users`.

| Campo | Notas |
|---|---|
| `rol` | `colaborador` · `coordinador` · `analista_th` · `gerente_th` · `administrador` |
| `estado` | `pendiente_validacion` · `activo` · `inactivo` |
| `coordinador_id` | Jefe por defecto; la solicitud puede señalar otro |
| `validado_por`, `validado_en` | Quién habilitó la cuenta y cuándo |

> No se reutiliza `profiles` de Cambio de Turnos para roles: su columna `rol`
> pertenece a esa aplicación. Compartir la tabla habría mezclado dos modelos de
> permisos distintos.

### Solicitudes

`permisos_solicitudes` guarda lo común a los dos formatos; el detalle va aparte.

| Campo | Notas |
|---|---|
| `consecutivo` | `PL-2026-00001` / `VA-2026-00001`, lo asigna un trigger al enviar |
| `codigo_verificacion` | 18 hex aleatorios para el QR del PDF |
| `estado` | Ver la máquina de estados en [ERD.md](ERD.md) |
| `extemporanea` | Se envió sin la antelación del formato |
| `coord_actor_id`, `coord_fecha` | Quién autorizó como jefe directo y cuándo |
| `th_actor_id`, `th_fecha` | Quién dio el visto bueno y cuándo |
| `deleted_at` | Borrado lógico; `DELETE` está revocado |

`permisos_detalle_permiso` añade horas, motivo, remuneración, compensación y el
control de soporte posterior. `permisos_detalle_vacaciones` añade los tres
saldos, la fecha de reintegro y la declaración de conformidad.

### Trazabilidad

| Tabla | Para qué |
|---|---|
| `permisos_historial` | Línea de tiempo legible que ve el usuario |
| `permisos_auditoria` | Registro ISO 9001 con `antes`/`después` en JSON |
| `permisos_eventos` | Bus para automatizaciones futuras |
| `permisos_notificaciones` | Bitácora de correos enviados |
| `permisos_adjuntos` | Metadatos de los soportes; el archivo va en Storage |
| `permisos_consecutivos` | Contador por prefijo y año |

Historial y auditoría son cosas distintas a propósito: el primero es para las
personas —«Autorizada por el jefe directo»— y el segundo para auditores, con el
detalle completo de cada columna que cambió.

## Triggers

| Trigger | Cuándo | Qué hace |
|---|---|---|
| `permisos_asignar_consecutivo` | BEFORE INSERT/UPDATE | Numera al salir de `BORRADOR` |
| `permisos_registrar_cambio_estado` | AFTER INSERT/UPDATE | Escribe el historial |
| `permisos_emitir_evento` | AFTER INSERT/UPDATE | Emite al bus de eventos |
| `permisos_auditar` | AFTER INSERT/UPDATE/DELETE | Registra la auditoría |
| `permisos_touch_updated_at` | BEFORE UPDATE | Actualiza `updated_at` |

**Un solo emisor de eventos.** El trigger de historial también emitía, y con los
dos activos cada envío y cada rechazo escribían el evento dos veces. Se separaron
las responsabilidades en la migración 015.

## Parámetros

`permisos_config` guarda JSON. Lo que la clínica puede ajustar sin desplegar:

| Clave | Valor | Efecto |
|---|---|---|
| `dominios_permitidos` | `[]` | Lista vacía = cualquier dominio de correo |
| `dias_umbral_soporte_cita_medica` | `2` | Desde cuántos días exige soporte |
| `dias_plazo_soporte_posterior` | `5` | Días hábiles para entregarlo |
| `max_mb_adjunto` | `10` | Tamaño máximo del soporte |
| `dias_vacaciones_periodo_completo` | `15` | Días hábiles del periodo completo |

## Migraciones

17 archivos en `supabase/migrations/`, aplicados en orden. Las que corrigen algo
llevan el motivo en la cabecera:

| Migración | Qué corrige |
|---|---|
| 010 | Endurece `sol_insert` de Cambio de Turnos |
| 012 | Cierra el escalamiento de privilegios en perfiles |
| 013 | `gen_random_bytes` fuera del `search_path` — bloqueaba toda solicitud |
| 015 | Elimina la doble emisión de eventos |
| 016 | La auditoría no encontraba la clave de las tablas de detalle |
| 017 | La bandeja sigue al jefe elegido, no solo al área |
| 018 | El admin de Permisos puede gestionar los catálogos compartidos |

## Storage

Bucket `soportes-permisos`, privado. Ruta `{solicitud_id}/{momento}/{archivo}`:
las policies resuelven el permiso a partir del primer segmento. PDF, JPG, PNG y
WEBP hasta 10 MB.

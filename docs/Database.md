# Base de datos

Proyecto Supabase `rykondrasrvnuurolqqk` (`cambiodeturnos`), Postgres 17.
Ver el diagrama en [ERD.md](ERD.md) y las policies en [SECURITY.md](SECURITY.md).

## Tablas propias

### Catálogos

| Tabla | Contenido |
|---|---|
| `permisos_empresas` | CAC Santa Bárbara, GE2, Geriater |
| `permisos_tramites` | Permiso, vacaciones y cesantías, con código, versión y antelación mínima |
| `permisos_categorias` | Las cinco casillas del TH-F-002 |
| `permisos_tipos` | Motivos, con sus reglas legales, de soporte y de aprobación |
| `permisos_documentos` | Catálogo de documentos soporte, con la norma que los exige |
| `permisos_tipos_documentos` | Matriz motivo × documento × momento |
| `permisos_config` | Parámetros editables sin desplegar |

`permisos_tipos` concentra lo que cada motivo sabe de sí mismo, y de ahí salen
casi todas las validaciones del formulario:

| Campo | Para qué |
|---|---|
| `naturaleza` | `permiso` · `licencia` · `incapacidad` · `tramite` |
| `genera_ausentismo` | `false` en trámites, comisiones sindicales y capacitaciones |
| `fundamento_legal` | La norma; se le muestra al colaborador al solicitar |
| `dias_max_retroactivo` / `dias_max_futuro` | Ventana de fechas que admite |
| `duracion_maxima_dias` | Tope; advierte, no bloquea |
| `permite_horas` | `false` en licencias e incapacidades, que van por días |
| `plazo_soporte_dias` / `plazo_soporte_habiles` | Plazo propio del soporte posterior |
| `max_por_periodo` / `periodo_control` | Cupo, p. ej. día de la familia: 1 semestral |
| `interrumpe_otros` / `prioridad` | Qué manda cuando dos ausencias se cruzan |
| `dias_calendario` | Se cuenta por calendario en vez de días hábiles |

Los booleanos `requiere_soporte_previo` y `requiere_soporte_posterior` siguen
existiendo porque el formulario los consulta, pero **ya no se mantienen a mano**:
un trigger los deriva de `permisos_tipos_documentos`. Así no puede haber un
motivo que diga «no pide soporte» con tres documentos obligatorios configurados.

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
| `consecutivo` | `PL-2026-00001` / `VA-2026-00001` / `CE-2026-00001`, lo asigna un trigger al enviar |
| `codigo_verificacion` | 18 hex aleatorios para el QR del PDF |
| `estado` | Ver la máquina de estados en [ERD.md](ERD.md) |
| `extemporanea` | Se envió sin la antelación del formato |
| `coord_actor_id`, `coord_fecha` | Quién autorizó como jefe directo y cuándo |
| `th_actor_id`, `th_fecha` | Quién dio el visto bueno y cuándo |
| `interrumpida_por_id`, `fecha_interrupcion` | Art. 187 CST: qué partió el periodo y desde cuándo |
| `dias_pendientes_reprogramar` | Días que quedaron sin disfrutar |
| `reprograma_a_id` | Solicitud nueva que consume ese saldo |
| `deleted_at` | Borrado lógico; `DELETE` está revocado |

`permisos_detalle_permiso` añade horas, motivo, remuneración, compensación y el
control de soporte posterior. `permisos_detalle_vacaciones` añade los tres
saldos, la fecha de reintegro y la declaración de conformidad.

### Ausentismo

`permisos_v_ausentismo` es una vista `security_invoker` —hereda RLS, así que el
coordinador solo ve su área—. Una fila por ausencia efectiva, con el colaborador,
el proceso, el cargo, el motivo, su naturaleza, días y horas.

Tres decisiones que toma la vista y conviene tener presentes al leer los números:

1. Deja fuera lo que no es ausencia: `genera_ausentismo = false`.
2. Un periodo suspendido cuenta **hasta el día de la interrupción**. Sumar el
   periodo completo contaría dos veces los mismos días: una en las vacaciones y
   otra en la incapacidad que las partió.
3. Cuenta desde el visto bueno, no desde el archivo: lo autorizado ya se ausentó
   aunque falte cerrar el papeleo del soporte.

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
| `permisos_tipos_documentos_sincroniza` | AFTER INSERT/UPDATE/DELETE | Deriva los flags de soporte del motivo |
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
| `horas_jornada` | `8` | Convierte horas de permiso en días de ausentismo |
| `dias_habiles_mes` | `24` | Denominador de los índices de ausentismo |
| `bloquear_solapamiento` | `false` | Los cruces de fechas advierten, no bloquean |

## Migraciones

Los archivos de `supabase/migrations/` se aplican en orden. Las que corrigen algo
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
| 20260801000200–600 | Revisión frente al Código Sustantivo del Trabajo: reglas por motivo, documentos soporte, motivos faltantes, interrupción de periodos y vista de ausentismo |
| 20260802000100 | El retiro parcial de cesantías deja de ser un motivo del formulario de permisos y pasa a ser trámite propio |

## Storage

Bucket `soportes-permisos`, privado. Ruta `{solicitud_id}/{momento}/{archivo}`:
las policies resuelven el permiso a partir del primer segmento. PDF, JPG, PNG y
WEBP hasta 10 MB.

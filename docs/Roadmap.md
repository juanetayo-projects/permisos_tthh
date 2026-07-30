# Roadmap

## Pendiente antes de usar en producción

| Qué | Quién | Notas |
|---|---|---|
| Pegar las plantillas de correo de Auth | Administrador | [plantillas_correo_auth.md](plantillas_correo_auth.md). Sin esto, el correo de registro llega en texto plano |
| Confirmar si TH quiere validar cada registro | Talento Humano | Si dicen que no, la cuenta se activaría al confirmar el correo |
| Revisar el catálogo de jefes directos | Talento Humano | 23 filas heredadas de Cambio de Turnos, sin verificar |
| Importar las personas de Cambio de Turnos | Administrador | Botón en Administración → Usuarios |
| Programar el cron de vencimientos | Administrador | `permisos-vencimientos`, a diario |

## Decisiones abiertas

**¿El 13 de junio es festivo fijo o trasladable?** Se implementó trasladable,
según indicó el cliente. Si fuera fijo, cambiaría el calendario de 2026 y 2028.

**¿Se separa la base de datos de Cambio de Turnos?** Hoy comparten proyecto
(decisión D2). Separarlas cuesta ~US$10/mes y obliga a que los usuarios se
registren de nuevo, pero elimina el acoplamiento en Auth y en catálogos.

**¿Se actualiza el perfil cuando alguien cambia de servicio?** El formulario
resuelve el caso puntual eligiendo el jefe, pero el dato maestro del perfil
sigue apuntando al servicio anterior hasta que TH lo corrija.

## Siguiente iteración

### Pruebas de RLS
La brecha más importante. Un cambio de policy podría abrir acceso indebido y
ninguna prueba lo detectaría. Ver [TESTING.md](TESTING.md).

### Creación de usuarios desde la aplicación
Hoy la persona se registra y TH la valida. Crear e invitar desde Administración
exige una Edge Function con credenciales de administrador de Auth.

### PDF del formato oficial
La exportación actual produce listados. Falta el PDF que replica el TH-F-002 y
el TH-F-005 con sus casillas y el sello de trazabilidad con QR — la
infraestructura ya está: consecutivo, código de verificación y página pública.

### Coordinador suplente
Cuando el jefe directo está de vacaciones, sus solicitudes se estancan. Hoy solo
hay alerta a las 24 horas.

## Más adelante

**Motor de saldos de vacaciones.** Causación automática de 15 días hábiles por
año cumplido y descuento al aprobar. Hoy los saldos se digitan y TH los valida
contra nómina (decisión D11).

**Módulo de IA.** Quedó fuera de la v1 pero el bus de eventos está listo: OCR de
soportes, clasificación automática, resumen de solicitudes, búsqueda semántica y
explicación de métricas.

**Integración con nómina.** Que el ausentismo aprobado alimente la liquidación
sin recaptura.

**Más trámites.** Incapacidades, licencias no remuneradas, teletrabajo. Añadir
uno es una fila en `permisos_tramites` y su formulario.

**Aplicación móvil o PWA.** Buena parte de los colaboradores solicita desde el
teléfono. La interfaz ya es responsive; faltaría instalación y notificaciones
push.

**Firma escaneada opcional.** Se descartó en la v1 a favor del sello con QR
(decisión D7), pero algunos procesos de auditoría externa aún la piden.

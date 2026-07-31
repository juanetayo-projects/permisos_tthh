# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.1.7] — 2026-07-31

### Cambiado

- **La ventana ya no hace scroll.** El armazón pasa a tener altura fija y cada
  pantalla decide qué zona suya se desplaza: encabezados, filtros y botones de
  decisión quedan siempre a la vista. Antes las barras eran `sticky`, que
  necesita justo lo contrario —que la página entera scrollee—, así que al
  crecer la lista se iban hacia arriba.
- **El detalle de la solicitud cabe en una pantalla.** Los soportes se
  fusionan con el panel de documentos de la derecha: eran dos piezas listando
  los mismos archivos, y entre las dos empujaban el detalle por debajo del
  pliegue. Espaciados más compactos y el historial acotado en alto.

### Añadido

- **Panel de documentos con vista previa**, al costado y con el mismo peso
  visual que el resumen del formulario: miniatura del archivo real —PDF
  incrustado o imagen—, ampliación en modal y acceso a la gestión del soporte
  sin salir de la solicitud.
- `Pantalla`, armazón común de las pantallas de listado, para no repetir la
  estructura de alto fijo en cada una.

## [0.1.6] — 2026-07-31

### Añadido

- **Estado `SOPORTE_EN_VALIDACION`** («Soporte en validación de Talento
  Humano»). `PENDIENTE_SOPORTE` mezclaba dos situaciones con responsables
  distintos —falta el documento, que le toca al colaborador; y el documento ya
  está entregado, que le toca a TH— y se distinguían solo por un booleano del
  detalle. Ahora cada estado tiene un único responsable.
- **Devolución del soporte**: si el documento no sirve, Talento Humano lo
  devuelve indicando qué falta. La solicitud vuelve a «pendiente de soporte»,
  el colaborador recibe el correo con el motivo y sube otro. Antes solo existía
  el camino de ida.

### Cambiado

- `PENDIENTE_SOPORTE` sale de la bandeja de Talento Humano: ahí la pelota la
  tiene el colaborador, y una bandeja llena de cosas que no puedes mover no es
  una bandeja de trabajo. TH ve `SOPORTE_EN_VALIDACION`.
- Etiquetas del flujo alineadas con el lenguaje de Talento Humano:
  «Autorizada, pendiente de justificar el soporte» y «Cerrada» (antes
  «Finalizada»).
- El Dashboard tenía copiadas en línea las listas de estados de los KPIs, así
  que al añadir uno nuevo el número y su detalle dejaban de coincidir. Ahora
  importa `EN_TRAMITE`, `APROBADAS` y `CON_SOPORTE_ABIERTO` del dominio.

## [0.1.5] — 2026-07-31

### Corregido

- **Un motivo no podía exigir soporte al solicitar *y* al regresar.**
  `evaluarSoporte` devolvía un único `momento` y salía en cuanto encontraba el
  previo, así que el posterior se perdía en silencio por mucho que se
  configurara en Administración. Ahora los dos momentos son independientes y
  el formulario avisa de cada uno.

### Cambiado

- **Cita médica** pasa a exigir soporte en los dos momentos y sin umbral de
  días: la orden al solicitar y la constancia de asistencia al regresar. Antes
  solo lo pedía cuando el ausentismo superaba 2 días, así que una cita de
  cuatro horas se cerraba sin ningún documento. Es configuración, editable en
  Administración → Motivos de permiso.

## [0.1.4] — 2026-07-31

### Añadido

- **Bloque de soportes en el detalle de la solicitud**: lista los adjuntos con
  enlace firmado de 60 s para abrirlos, deja al solicitante entregar el soporte
  posterior mientras la solicitud está en «Pendiente de soporte», y da a
  Talento Humano el botón *Validar soporte y finalizar*. Hasta ahora el motor
  de estados contemplaba ese paso pero no había ninguna pantalla desde donde
  darlo: `PENDIENTE_SOPORTE → FINALIZADA` era inalcanzable y un permiso de más
  de dos días por cita médica se quedaba atascado para siempre.

### Cambiado

- El rol `administrador` puede dar el visto bueno de Talento Humano, rechazar
  en ese paso y validar soportes, y ve la bandeja de TH. Sin esto una solicitud
  se quedaba clavada en `PENDIENTE_TH` cuando no había ningún analista o
  gerente disponible.
- `registrar_soporte` ya no se le ofrece a Talento Humano: la policy de Storage
  ata la ruta al `solicitante_id`, así que esa subida siempre habría fallado
  contra el servidor.

### Corregido

- En la bandeja de TH, dar el visto bueno a una solicitud que ya estaba en
  «Pendiente de soporte» la devolvía a su propio estado y se quedaba dando
  vueltas en la bandeja. Ahora la valida y la finaliza.

## [0.1.3] — 2026-07-31

### Corregido

- **Una solicitud autorizada aparecía como rechazada.** El diálogo de decisión
  pide texto en los dos casos —obligatorio al rechazar, opcional al
  autorizar— y los dos acababan en `motivo_rechazo`, que el detalle pinta en
  rojo como «Causa del rechazo». La observación pasa a su propia columna
  `observacion_decision`; el historial toma el texto de la que corresponda al
  paso. La migración corrige también las filas ya escritas.

### Añadido

- **Todas las solicitudes**: histórico completo para Talento Humano y
  administración, con pestañas por estado, filtros de trámite y área y
  exportación a Excel y PDF. Las bandejas solo muestran lo que espera decisión,
  así que al autorizar una solicitud no quedaba ninguna pantalla desde donde
  volver a encontrarla.
- Pantalla propia cuando la sesión abierta no tiene acceso a una sección: dice
  con qué cuenta se entró y ofrece cambiar de cuenta. Antes se reutilizaba el
  cartel de «módulo en construcción», que ni era cierto ni daba salida —el caso
  típico es el jefe abriendo «Ir a mi bandeja» en un equipo donde quedó la
  sesión del solicitante.

### Cambiado

- Detalle de la solicitud rediseñado con el sistema de bloques de color ya
  existente: cabecera en relieve con franja del estado, un color por bloque de
  datos e hitos del historial coloreados por tono. Se añade la variante
  `bloque-rojo`, reservada a rechazos y cancelaciones.

## [0.1.2] — 2026-07-31

### Corregido

- **El enlace de recuperación de contraseña daba «enlace no válido».** Con el
  flujo PKCE, el enlace vuelve con un `?code=` que solo se puede canjear en el
  mismo navegador que pidió el cambio, porque el `code_verifier` vive en su
  `localStorage`. Si no está, `auth-js` ni siquiera intenta el canje. Ahora el
  correo lo envía la Edge Function `permisos-recuperar-clave` por Resend, con
  un enlace de `token_hash` que la app canjea con `verifyOtp` y que **funciona
  en cualquier dispositivo**. No se tocó la plantilla de Auth porque la
  comparte Cambio de Turnos.
- La pantalla de establecer contraseña canjea el enlace antes de decidir, en
  vez de dar por inválido todo lo que no traiga ya una sesión abierta. Si aun
  así llega un código PKCE sin verificador, lo explica en vez de decir que el
  enlace caducó.

### Añadido

- Edge Function `permisos-recuperar-clave`, con freno de un correo por minuto
  y por destinatario, y respuesta idéntica exista o no la cuenta.
- Medidor de fortaleza también al establecer la contraseña nueva, y mensaje
  propio cuando Supabase rechaza una contraseña por aparecer en filtraciones.

## [0.1.1] — 2026-07-30

### Añadido

- **Administración de procesos/áreas y de cargos**: hasta ahora los dos
  desplegables del registro solo se podían tocar en la base de datos, así que
  quien no encontraba su cargo se quedaba sin poder crear la cuenta. Llevan el
  aviso de catálogo compartido con Cambio de Turnos.
- **Barra de fortaleza de la contraseña** en el registro y al establecer una
  nueva: cuatro segmentos de color, con el motivo escrito al lado. Degrada las
  claves que repiten el nombre, el correo o el documento de la propia persona.

### Corregido

- **El registro decía «revisa tu correo» aunque no fuera a llegar ninguno.**
  Ante un correo que ya tiene cuenta, Supabase responde 200 y no envía nada,
  a propósito, para no revelar qué direcciones están dadas de alta. Como el
  proyecto de Supabase es el mismo de Cambio de Turnos, cualquiera con cuenta
  allí caía en este caso. Ahora se detecta y la pantalla ofrece iniciar sesión
  o recuperar la contraseña.
- Los catálogos recién creados ya aparecen en el formulario de registro sin
  recargar: la caché de la RPC `permisos_catalogos_registro` se invalidaba.
- El nombre repetido en un catálogo mostraba el error crudo de Postgres; ahora
  avisa de que puede existir desactivado.

## [0.1.0] — 2026-07-30

Primera versión desplegada en https://juanetayo-projects.github.io/permisos_tthh/

### Añadido

- **Autenticación y onboarding**: registro con cualquier dominio de correo,
  confirmación, recuperación de contraseña y validación de perfiles por Talento
  Humano antes de habilitar a la persona.
- **Solicitud de permiso (TH-F-002)** y **de vacaciones (TH-F-005)**, cada una
  en una sola pantalla sin scroll, con panel de resumen en vivo.
- **Cálculo de días hábiles** con festivos colombianos y Ley Emiliani: duración
  del permiso, fecha final de vacaciones y fecha de reintegro.
- **Bandejas por rol**: jefe directo, Talento Humano y Gerencia para cesantías,
  con acciones en lote y rechazo con motivo obligatorio.
- **Panel ejecutivo** con ocho KPIs, tendencia mensual, distribución, mapa de
  calor área × mes y ranking, todo con drill-down al detalle.
- **Exportación a Excel y PDF** con logo institucional, títulos y filtros
  aplicados.
- **Administración**: usuarios y roles, jefes directos, trámites, categorías,
  motivos, empresas, parámetros y consulta de auditoría.
- **Importación de personas** que ya existen en Cambio de Turnos.
- **Notificaciones por correo** en cada paso, con plantillas institucionales.
- **Verificación pública por QR** del documento aprobado, sin necesidad de
  tener cuenta.
- **Trazabilidad ISO 9001**: historial legible, auditoría con antes/después y
  bus de eventos para automatizaciones futuras.
- **CI/CD**: lint, tipos, pruebas, compilación y despliegue automático.

### Corregido durante el desarrollo

Todos encontrados probando la aplicación, no revisando código.

- **Ninguna solicitud podía crearse.** Dos fallos bloqueantes encadenados en la
  misma ruta: el trigger del consecutivo llamaba a `gen_random_bytes` fuera de
  su `search_path`, y la auditoría no encontraba la clave primaria de las
  tablas de detalle, que usan `solicitud_id` en vez de `id`.
- **La solicitud no llegaba al jefe correcto.** La función de correos leía el
  coordinador del perfil y las policies resolvían la bandeja solo por área, así
  que el jefe elegido en el formulario se guardaba y no servía para nada.
- **Eventos duplicados.** Al conectar el bus quedaron dos emisores solapados y
  cada envío y cada rechazo escribían el evento dos veces.
- **La exportación a PDF fallaba en silencio.** La carga de la tipografía de
  pdfmake no contemplaba la forma real del módulo: sin fuente no genera nada y
  no avisa.
- **1,4 MB innecesarios en el arranque.** Declarar Recharts y ECharts en
  `manualChunks` hacía que Vite les añadiera `modulepreload`.
- **Los desplegables del registro llegaban vacíos**, porque las policies de los
  catálogos exigen sesión y quien se registra aún no la tiene.
- **Las metric cards en cero eran invisibles**: el color dependía del valor y
  caía a un gris casi idéntico al fondo.
- **Los formatos se desbordaban** 18 px y 109 px a 1366×768.
- **La barra lateral no cubría la altura** al bajar en el dashboard.
- **El CI se rompió en la primera ejecución**: faltaba la configuración de
  ESLint y una prueba de dominio arrastraba el cliente de Supabase.

### Seguridad

- Cerrado un **escalamiento de privilegios**: un `analista_th` podía otorgarse
  el rol de administrador.
- Endurecida la inserción en `cambiodeturnos.solicitudes`, que quedó expuesta al
  compartir `auth.users` entre las dos aplicaciones.
- Activada la protección de contraseñas filtradas.
- Funciones `SECURITY DEFINER` con `search_path` acotado.

### Cambios de alcance durante el desarrollo

- **Vacaciones (TH-F-005) entró en la v1.** No estaba en el prompt inicial;
  apareció al revisar las plantillas del cliente.
- **El registro dejó de exigir correo institucional.** Muchos colaboradores no
  tienen cuenta `@cacsantabarbara.co`.
- **El 13 de junio se añadió como festivo** desde 2026, trasladable por Ley
  Emiliani.
- **El solicitante elige su jefe directo**, porque puede haber cambiado de
  servicio.

## Pendiente

Ver [Roadmap.md](Roadmap.md).

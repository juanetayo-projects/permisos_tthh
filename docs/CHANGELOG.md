# Historial de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/).

## [0.4.0] — 2026-08-02

### Cambiado

- **Permisos estrena proyecto Supabase propio** (`hvbatymkcpsxhuzkagoi`). Vivía
  dentro del de Cambio de Turnos y compartía con él `auth.users`, `areas`,
  `cargos` y `coordinadores` (decisión D2). Lo que costó esa convivencia:

  - Las plantillas de correo de Auth son del proyecto, no de la app: tocarlas
    para Permisos habría roto la otra, y por eso existe la Edge Function
    `permisos-recuperar-clave`.
  - Un cambio en una app podía romper la otra. Pasó: la policy `sol_insert` de
    Cambio de Turnos dejaba insertar a un usuario de Permisos.
  - Media Administración avisaba «este catálogo lo comparten las dos apps».

  Se separó ahora porque Permisos tenía 4 perfiles y 3 solicitudes frente a los
  26 usuarios y 7.584 solicitudes de la otra: cada colaborador que se registre
  encarece la migración. Se copiaron los 57 registros de catálogos y se
  recrearon las 4 cuentas; el esquema se reproduce desde `supabase/migrations/`.
  La migración que endurecía la tabla de Cambio de Turnos se movió a
  `supabase/migraciones_cambiodeturnos/`: no debe replicarse.
- **Los adjuntos aceptan varios archivos.** Casi ningún soporte real viene en
  uno solo: el luto pide registro de defunción **y** prueba de parentesco, y una
  incapacidad escaneada llega en varias fotos. Antes había que elegir cuál subir
  y Talento Humano devolvía la solicitud para pedir el resto. Los archivos se
  acumulan —adjuntar de dos en dos desde el celular no pierde lo anterior—, se
  etiquetan con el documento que les toca en el orden de la matriz, y en la
  entrega posterior el estado solo cambia con el último: si cambiara antes, la
  policy dejaría de permitir subir los que faltan.

### Corregido

- **El consecutivo ignoraba el prefijo del trámite.** Al corregir
  `gen_random_bytes` (migración 013) la función quedó con un `CASE` fijo a
  `VA`/`PL`, así que el trámite de cesantías se habría numerado `PL-…` en vez de
  `CE-…`. Vuelve a leer `prefijo_consecutivo` del catálogo.
- Las Edge Functions leían la clave de Resend del Vault de Cambio de Turnos
  (`public.get_secret`) y `permisos-crear-usuario` buscaba usuarios existentes en
  su tabla `profiles`. Ninguna de las dos cosas existe en el proyecto propio.

## [0.3.3] — 2026-08-02

### Cambiado

- **Los formatos vuelven a caber sin desplazarse.** La revisión del Código
  Laboral añadió al formulario la lista de documentos, el fundamento legal y el
  aviso de cruces, y entre las tres piezas el TH-F-002 dejó de caber en un
  portátil: aparecía una barra de desplazamiento donde antes no la había.
  - Los documentos exigidos pasan a **una línea por documento**, con los dos
    momentos en el mismo bloque y el detalle en el tooltip. La versión
    desplegada —descripción y norma bajo cada documento— se queda donde de
    verdad hace falta: la validación de Talento Humano, que sí tiene sitio.
  - La línea de tiempo estrena modo compacto: hitos en una sola fila, sin los
    círculos ni la leyenda. Costaba unos 130 px para decir dos fechas.
  - El fundamento legal es ahora una línea con el texto completo en el tooltip.

  El desplazamiento interno de la columna se mantiene como red de seguridad: sin
  él, un motivo con muchos soportes volvería a dejar los botones fuera de
  alcance en pantallas pequeñas.

## [0.3.2] — 2026-08-02

### Corregido

- **Se podía enviar un permiso sin cargo.** El cargo va impreso en el TH-F-002
  y es uno de los cortes del informe de ausentismo, pero ningún formulario lo
  exigía: bastaba con que el perfil no lo tuviera. Se validan también empresa y
  servicio, que fallan por lo mismo —un perfil incompleto— y sin los cuales la
  solicitud no llega a ninguna bandeja. Los tres campos llevan ahora asterisco.

### Cambiado

- **Los avisos de error salen en un modal, con la causa y su motivo.** Eran una
  frase roja al pie del formulario y, en un formato que ocupa toda la pantalla,
  quedaban fuera de la vista justo cuando aparecían. Peor: decían *qué* faltaba
  pero nunca *por qué* se exigía, así que pedir el cargo parecía un capricho
  del sistema.

  El modal lista **todos** los problemas a la vez. Antes se cortaba en el
  primero, así que el colaborador los descubría de uno en uno, a un intento de
  envío por dato. Y corre **antes** de la confirmación del jefe: encadenar dos
  modales hacía confirmar un envío que la validación iba a detener.
- Las reglas viven en `domain/validacion.ts`, con pruebas, en vez de repartidas
  en tres cadenas de `if` casi iguales. Los errores de Supabase se traducen ahí
  mismo: «new row violates row-level security policy» no le dice nada a quien
  solicita, y era lo que aparecía al pie.
- **El monto de cesantías se escribe en pesos.** `3500000` se quedaba en
  pantalla como una tira de siete dígitos que nadie lee de un vistazo —¿tres
  millones y medio o treinta y cinco?—. Ahora se formatea al teclear como
  `$ 3.500.000`, se guarda limpio y acepta un importe pegado ya formateado.

## [0.3.1] — 2026-08-02

### Corregido

- **Los formularios de permiso y de vacaciones se salían de la pantalla.** En
  escritorio la ventana no scrollea a propósito —lo decide cada pantalla—, y
  estos dos no lo habían decidido: quedaban fuera de alcance la justificación,
  la compensación y los propios botones de guardar y enviar, así que no había
  forma de terminar la solicitud. Ahora la columna de campos se desplaza por
  dentro y las acciones quedan siempre a la vista, como ya hacía el detalle de
  la solicitud.
- El panel de resumen se desborda igual: con seis advertencias, la nota al pie
  del formato se salía del panel. Los avisos se llevan el espacio sobrante y se
  desplazan por dentro.

### Cambiado

- **El retiro parcial de cesantías tiene trámite y pantalla propios**
  (`/solicitar/cesantias`), como las vacaciones. Se tramitaba en el formulario
  de permisos y eso obligaba a responder cosas que ahí no significan nada
  —fecha de inicio, fecha de fin, hora de salida, hora de regreso—; encima
  advertía que «faltan 21 horas para el inicio y el formato exige 48», cuando un
  retiro de cesantías no tiene inicio ni antelación que cumplir.

  El trámite nuevo numera aparte (`CE-2026-00001`), tiene antelación cero y
  pregunta lo que de verdad decide la Gerencia: la destinación —solo vivienda o
  educación, art. 102 CST y Ley 1071 de 2006—, el monto y sus soportes. Las
  solicitudes ya radicadas se movieron al trámite nuevo conservando su
  consecutivo: renumerarlas rompería la trazabilidad de un documento que ya
  circuló firmado.
- Los motivos de naturaleza `tramite` dejan de ofrecerse en el formulario de
  permisos, y un trámite ya no ocupa fechas: no cruza con otros permisos, no se
  puede interrumpir y no muestra periodo ni duración en su detalle.
- `etiquetaTramite` y `esAusencia` en `domain/tramites.ts`. El código estaba
  lleno de `codigo === 'vacaciones' ? 'Vacaciones' : 'Permiso'`, y al aparecer
  un tercer trámite todos esos ternarios lo habrían etiquetado como «Permiso»,
  que es justo lo que se estaba separando.

## [0.3.0] — 2026-08-01

Revisión de la aplicación frente al Código Sustantivo del Trabajo. El detalle
para Talento Humano, con las once decisiones que quedan a su criterio, está en
[`INFORME_CODIGO_LABORAL.md`](./INFORME_CODIGO_LABORAL.md).

### Añadido

- **Documentos soporte con nombre propio.** `permisos_documentos` (catálogo con
  la norma que respalda cada documento) y `permisos_tipos_documentos` (qué exige
  cada motivo y en qué momento). Antes había dos booleanos que decían *si* hacía
  falta un soporte pero nunca *cuál*: el colaborador subía lo que creía, TH lo
  devolvía, y el trámite daba una vuelta completa por una diferencia que estaba
  clara desde el principio.
- **Lista de verificación al finalizar.** La solicitud pasa a validación de TH
  solo cuando no falta ningún documento obligatorio. El luto exige registro de
  defunción *y* prueba de parentesco; con el modelo anterior, el primero cerraba
  el paso y había que devolverlo para pedir el segundo.
- `permisos_adjuntos.documento_id`: cada archivo sabe qué documento es. Sin eso,
  una solicitud con tres documentos exigidos y dos adjuntos no se podía cerrar
  porque nadie sabía cuál faltaba.
- **Diecisiete motivos nuevos**, con su fundamento legal a la vista del
  colaborador: cargo transitorio de forzosa aceptación y comisión sindical
  —enumerados en el art. 57 num. 6 CST y que nunca existieron—, citación
  judicial, jurado de votación (Ley 1475 de 2011, distinto de votar), las cinco
  licencias parentales por separado, incapacidad por accidente de trabajo y por
  enfermedad laboral (el Decreto 1072 de 2015 obliga a separarlas de la
  enfermedad general), control prenatal, donación de sangre, acompañamiento a
  familiar, formación o estudio, permiso no remunerado y capacitación
  institucional. Cuatro entran desactivados a la espera del visto bueno de TH.
- **Ventana de fechas por motivo.** Cada uno declara cuánto admite hacia atrás y
  hacia adelante. Antes la única regla era «no antes de hoy, salvo calamidad y
  luto»: una incapacidad expedida el viernes no se podía registrar el lunes, y
  un permiso para dentro de tres años se aceptaba sin objeción. A diferencia de
  la antelación, esto sí acota el selector —una fecha fuera de rango no es una
  solicitud extemporánea, es un dato equivocado—.
- **Duración máxima y cupo por periodo.** El luto son 5 días hábiles (Ley 1280
  de 2009) y el día de la familia es semestral (Ley 1857 de 2017): el sistema
  lleva la cuenta en vez de confiar en que alguien se acuerde. La duración
  advierte y no bloquea, porque la prórroga de una incapacidad existe.
- **Plazo del soporte por motivo**, en días hábiles o calendario. Un único
  plazo global obligaba a elegir entre los tres días hábiles de una incapacidad
  y el mes del certificado electoral; y «un mes» no son treinta días hábiles en
  ninguna norma.
- **Interrupción de periodos (art. 187 CST).** Estado `SUSPENDIDA`, RPC
  `permisos_interrumpir` y `permisos_reprogramar`, y detección de cruces en el
  formulario. Cuando una incapacidad cae dentro de unas vacaciones, el periodo
  se suspende y los días no disfrutados quedan pendientes; antes se cerraban las
  vacaciones completas y esos días se perdían sin dejar rastro.
- **Módulo de ausentismo** (`/ausentismo`): vista `permisos_v_ausentismo`,
  indicadores de la GTC 3701 y la Resolución 0312 de 2019, cortes por
  colaborador, proceso, motivo y cargo, mapa de calor, filtros por todo lo
  pedido y exportación a Excel y PDF. Va aparte del panel ejecutivo porque
  responde a otra pregunta: aquel mide el flujo de solicitudes y este, tiempo no
  laborado.
- Secciones **Documentos** y **Documentos exigidos** en Administración, y los
  campos nuevos del motivo en su editor.

### Cambiado

- **Los trámites dejan de contar como ausentismo.** El retiro parcial de
  cesantías se firma en este formato pero no es una falta al trabajo, y aparecía
  en las estadísticas como si el colaborador hubiera faltado. Lo mismo con la
  comisión sindical y la capacitación institucional, donde se está cumpliendo
  una función. Se distingue por la columna `naturaleza` del motivo.
- **Las horas de salida y regreso solo aparecen si el motivo las admite.** El
  formulario las pedía incluso en una licencia de maternidad de 18 semanas,
  donde no significan nada y además distorsionaban el cálculo de la duración.
- `requiere_soporte_previo` y `requiere_soporte_posterior` pasan a derivarse de
  la matriz por trigger: ya no puede haber un motivo que diga «no pide soporte»
  con tres documentos obligatorios configurados.
- «Licencia de maternidad o paternidad» queda desactivada —no borrada, para no
  romper las solicitudes ya radicadas— en favor de los motivos específicos.

### Seguridad

- `permisos_sincronizar_flags_soporte` es un trigger, no una API. Postgres
  concede `EXECUTE` a `public` por defecto y PostgREST la publicaba en
  `/rest/v1/rpc`, de modo que cualquiera sin sesión podía invocar una función
  `SECURITY DEFINER`. Se revoca; el trigger sigue disparando igual.

## [0.2.2] — 2026-08-01

### Añadido

- **Carrilera del proceso en Inicio.** Cinco estaciones sobre una vía continua
  —solicitas, autoriza tu jefe, visto bueno de TH, entregas el soporte,
  cerrada—, cada una con su icono, quién actúa y qué ocurre ahí en una frase.
  Quien entra por primera vez no sabía cuántas manos toca su solicitud ni por
  qué queda «pendiente» de alguien, y terminaba preguntando por teléfono.
- Los pasos del rol de quien mira se destacan con «te toca»: al colaborador le
  interesa saber qué le corresponde, no memorizar el flujo entero.
- Los desvíos —rechazo y devolución del soporte— van aparte, al pie: no son
  pasos del camino y mezclarlos en la vía la haría ilegible.

## [0.2.1] — 2026-08-01

### Corregido

- **La línea de tiempo mostraba el día anterior.** `desdeISO` construye la
  fecha en UTC —para que el huso no corra un día al comparar— y la tira de
  días la leía con `getDate()`, que en Colombia va cinco horas por detrás: el
  4 de agosto salía como «lunes 3» y el festivo se pintaba en el día
  equivocado. Se añaden `diaDelMes` y `diaDeLaSemana` al dominio, con pruebas,
  para que no se repita.
- **El modo oscuro por defecto no llegaba a quien ya había usado la app.** La
  versión anterior escribía `claro` en cada arranque a quien tuviera el sistema
  en claro, así que su preferencia guardada seguía ganando. La clave estrena
  sufijo (`permisos-tema-2`) para repartir el nuevo valor por defecto una vez.

### Añadido

- **`dias_calendario` en los motivos de permiso**, editable desde
  Administración: incapacidades y licencias pueden empezar cualquier día y se
  cuentan por calendario; citas y diligencias siguen restringidas a días
  hábiles. Antes la única excepción era `exento_antelacion`, que servía a la
  vez para dos cosas distintas.
- La tira de días colorea el motivo de cada día no hábil: **ámbar** el fin de
  semana y **rojo** el festivo, con su leyenda.

### Cambiado

- En la solicitud de permiso, **el motivo va antes de las fechas**: es el que
  decide qué días se pueden elegir y cómo se cuentan.

## [0.2.0] — 2026-07-31

### Añadido

- **Línea de tiempo del periodo** en los dos formularios: hitos de inicio, fin
  y reintegro, y una tira con cada día del permiso marcando los que no se
  trabajan. Con dos campos de fecha sueltos, un permiso que se cruza con un
  puente parecía más largo de lo que era.
- **Confirmación del jefe directo antes de enviar.** La propuesta por área
  acierta casi siempre, pero cuando falla el aviso le llega a alguien que no
  tiene que ver, y el error se descubre con la solicitud parada varios días.
- **Botón de limpiar filtros** en «Todas las solicitudes» (el Dashboard ya lo
  tenía).
- En la cabecera del detalle, **quién autorizó con fecha y hora** y, mientras
  está en Talento Humano, qué falta para cerrar.

### Cambiado

- **Modo oscuro por defecto**, aplicado antes del primer render para que
  alcance también al login, al registro y a la recuperación —el tema se
  decidía dentro de la app, así que esas tres pantallas salían siempre claras—
  y sin el parpadeo de un fondo que se oscurece.
- **Bordes visibles en oscuro**: `--border` sube de `#1e2b45` a `#33436b`.
  Estaba tan cerca del fondo de las tarjetas que la pantalla se leía como una
  mancha.
- **Login con el patrón de SIAU**: fondo azul a pantalla completa y una sola
  tarjeta centrada con la banda de cabecera dentro.
- El botón de cerrar sesión pasa a fondo blanco sobre la franja: en
  translúcido se confundía con la propia barra lateral.
- **Las fechas de solicitud rechazan sábados, domingos y festivos**
  colombianos, corrigiendo al siguiente día hábil y explicando por qué. Los
  motivos exentos de antelación —calamidad y luto— sí los admiten: ocurren
  cuando ocurren.

### Corregido

- **El logo se montaba sobre el título en Excel**: iba dimensionado a 150 px
  fijos y se salía de la columna A, que es tan ancha como pida el consecutivo.
  Ahora se confina al rango `A1:A3`.
- En el PDF, el logo se acota con `fit` en vez de `width`: con `width` la
  altura crecía según la proporción del PNG, la cabecera se pasaba del margen
  superior y el contenido acababa pisándola.

## [0.1.10] — 2026-07-31

### Corregido

- **Una nota del visto bueno se mostraba como «Talento Humano devolvió el
  soporte».** Autorizar con observación y devolver un soporte dejan la
  solicitud en el mismo estado y con el texto en la misma columna, así que el
  panel los pintaba igual. Se distinguen por el estado del que viene el último
  paso (`esSoporteDevuelto`), con pruebas.

### Cambiado

- **Quién autoriza va en la cabecera del detalle**, siempre visible: nombre,
  cargo y área del jefe directo. Estaba solo en un bloque de la columna
  izquierda, que podía quedar por debajo del pliegue justo cuando el
  solicitante quiere confirmarlo. Al quitar ese bloque, la columna deja además
  de necesitar scroll.
- El botón de entrega del soporte pasa a llamarse **«Guardar y enviar a
  Talento Humano»** y dice qué ocurre después, para no dejar al colaborador
  esperando un cierre que no depende de él.

## [0.1.9] — 2026-07-31

### Añadido

- **Modal de confirmación al enviar una solicitud**, con el consecutivo en
  grande y el resumen de lo guardado. Antes se navegaba a «Mis solicitudes»
  con una línea de texto y el número —por el que se pregunta en Talento Humano
  y que va impreso en el formato— pasaba desapercibido.
- **Bloque «Autorización» en el detalle**: jefe directo, su cargo y su área.
  Era el dato que responde «¿a quién le toca ahora?» y había que deducirlo del
  historial.

### Cambiado

- El formulario de nuevo usuario pasa a tres columnas y cabe sin scroll, con
  cabecera de color institucional.
- El aviso de enlace de contraseña inválido explica la causa real: **cada
  enlace nuevo anula el anterior**, así que con varios correos en la bandeja
  solo sirve el último. Decir «caducó» llevaba a pedir otro y repetir el error.
  El propio correo lo advierte ahora.

## [0.1.8] — 2026-07-31

### Añadido

- **Alta de usuarios desde Administración → Usuarios y roles.** Hasta ahora la
  única vía era el autorregistro, que exige un segundo paso de validación:
  hasta que Talento Humano lo hacía, la persona no podía solicitar nada. Al
  crearla desde la consola, quien da de alta es quien valida, así que la cuenta
  nace **activa** y lista para usarse.
- La contraseña no la escribe quien crea la cuenta: la persona recibe un correo
  de bienvenida con un enlace para definirla. Si el correo falla, el alta sigue
  siendo válida y basta con usar «¿Olvidaste tu contraseña?».
- Si el correo ya tiene cuenta en Cambio de Turnos, se reutiliza en vez de
  fallar, y se avisa de que entrará con la contraseña que ya usa allí.

### Seguridad

- Quién puede dar de alta se comprueba **en la Edge Function**, no en la
  interfaz: Talento Humano y administración pueden crear colaboradores, pero
  solo el administrador puede asignar otro rol. Sin esa línea, un analista
  podría fabricarse un administrador y saltarse la separación de funciones que
  sostiene el flujo de aprobaciones. Verificado: una llamada sin sesión válida
  responde 401 y no crea nada.

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

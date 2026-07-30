# Decisiones de diseño

Cada decisión con su motivo. Las marcadas ⚠️ tienen contrapartidas que conviene
recordar antes de tocarlas.

## Aprobadas antes de programar

### D1 · React + Vite, no Next.js
`concepto_general.txt` pedía Next.js 15. Se descartó porque **Next.js con SSR no
corre en GitHub Pages**, y el resto de aplicaciones clínicas ya usan React+Vite.
La lógica de servidor vive en Edge Functions.

### D2 ⚠️ · Base de datos compartida con Cambio de Turnos
Se reutiliza el proyecto Supabase `rykondrasrvnuurolqqk` con tablas prefijadas
`permisos_`. Ahorra ~US$10/mes y reutiliza en vivo áreas, cargos y coordinadores.

**Contrapartidas reales, todas encontradas durante el desarrollo:**
- `auth.users` es común: quien tiene cuenta en una app puede entrar a la otra.
- Cualquier ajuste de Auth (plantillas, URLs de redirección) afecta a ambas.
- Editar `coordinadores` desde Permisos cambia lo que ve Cambio de Turnos.
- Obligó a endurecer `sol_insert` en la otra app (ver [SECURITY.md](SECURITY.md)).

Separarlas sigue siendo posible: proyecto nuevo, reaplicar las 17 migraciones y
asumir que los usuarios se registran de nuevo.

### D3 · Neumorfismo solo donde ayuda
`prompt_inicial.txt` pedía neumorfismo; `concepto_general.txt`, Stripe/Linear.
Se aplicó relieve a metric cards y paneles del dashboard, y base plana a tablas
y formularios, donde el relieve resta legibilidad.

### D4 · Motivos en dos niveles
Categoría del formato (Personal, Día de la Familia, Salud, Empresarial,
Calamidad) → motivo específico. El PDF marca la casilla oficial y las
estadísticas se hacen por motivo. El ejemplo real del cliente lo justificó: una
cita médica del hijo aparecía marcada como *Día de la Familia*.

### D5 · Registro abierto, validación de TH
**Cambió durante el desarrollo.** Empezó restringido a `@cacsantabarbara.co`,
pero muchos colaboradores no tienen cuenta institucional. Hoy acepta cualquier
dominio y el control real es la validación de Talento Humano: la cuenta nace
inerte y no puede hacer nada hasta que TH confirme identidad, servicio y jefe.

La restricción por dominio sigue disponible en `permisos_config.dominios_permitidos`
(lista vacía = cualquier dominio).

> Pendiente de confirmar con Talento Humano si quieren mantener este paso.

### D6 · Cinco roles
`colaborador`, `coordinador`, `analista_th`, `gerente_th`, `administrador`. Las
cesantías van directo a `gerente_th`.

### D7 · Sello de trazabilidad, no firma manuscrita
El PDF imprime consecutivo, aprobadores con fecha y hora, y un QR que apunta a
una página pública de verificación. Cumple ISO 9001 sin firmas escaneadas.

### D8 · Alcance de la v1
Núcleo + dashboard + reportes + testing/CI-CD. **El módulo de IA queda fuera**;
el bus de eventos ya está para cuando llegue.

### D9 · Dos trámites sobre un motor común
Cabecera compartida más detalle por trámite. Añadir un tercer formato es una
fila en `permisos_tramites` y su formulario.

### D10 · Códigos de formato editables
`TH-F-002` y `TH-F-005` con código, versión y vigencia administrables, para que
Calidad publique una versión nueva sin desplegar.

### D11 ⚠️ · Saldos de vacaciones a mano
Los tres saldos los digita el colaborador y los valida Talento Humano contra
nómina. La app calcula los días hábiles en paralelo y avisa si no cuadran, pero
no impide enviar. El motor automático de causación queda en el roadmap.

### D12 · Vacaciones: jefe directo → Dirección de TH
Coincide con las tres casillas de firma del formato.

## Tomadas durante el desarrollo

### D13 · Las reglas de antelación avisan, no bloquean
48 horas en permisos, 20 días en vacaciones. Los propios ejemplos del cliente
las incumplían. La solicitud se marca `extemporanea` y eso se mide en el
dashboard, que es más útil que impedir el registro.

### D14 · Calamidad y luto exentos de fecha mínima
El calendario no deja elegir días pasados, **salvo** en motivos marcados
`exento_antelacion`. Un luto ocurrido ayer tiene que poder registrarse.

### D15 · El solicitante elige su jefe directo
Deducirlo del perfil fallaba con quien hubiera cambiado de servicio: la
solicitud caía en la bandeja del jefe anterior. Ahora se elige explícitamente,
proponiendo el del servicio seleccionado.

### D16 · La cédula se captura al solicitar
El formato la exige y muchos perfiles heredados no la tienen. Se pide en la
solicitud y se guarda en el perfil: solo hay que escribirla una vez.

### D17 · Los catálogos se desactivan, no se borran
Un motivo referenciado por solicitudes históricas rompería la trazabilidad al
eliminarse. `activo = false` lo saca de los formularios y conserva el histórico.

### D18 · No se puede dejar el sistema sin administradores
Sin ningún admin activo nadie podría volver a asignar el rol: habría que entrar
por base de datos. La interfaz bloquea el último.

### D19 · Los correos de Auth son de Supabase, no de la app
Confirmación y recuperación las envía Supabase con sus plantillas. Las del flujo
salen por Resend desde `permisos-notificar`. Por eso hay dos sistemas de
plantillas y las de Auth se pegan a mano ([plantillas_correo_auth.md](plantillas_correo_auth.md)).

### D20 · Recharts y ECharts fuera del chunking manual
Declararlos en `manualChunks` hacía que Vite les añadiera `modulepreload`: 1,4 MB
descargados en el arranque aunque el usuario nunca abriera el dashboard.

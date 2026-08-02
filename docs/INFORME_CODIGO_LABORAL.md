# Informe para Talento Humano — soportes, motivos y ausentismo

**Aplicación:** Permisos y Vacaciones · Clínica CAC Santa Bárbara
**Formatos:** TH-F-002 V02 (permisos) y TH-F-005 V02 (vacaciones)
**Fecha:** 1 de agosto de 2026
**Para:** visto bueno del equipo de Talento Humano

---

## 1. Qué se revisó y qué cambió

Se contrastó la aplicación con el Código Sustantivo del Trabajo y las normas
colombianas que regulan permisos, licencias e incapacidades. La revisión cubrió
cuatro frentes: **qué documentos se exigen y cuándo**, **qué motivos faltaban**,
**qué fechas admite cada motivo** y **qué pasa cuando dos ausencias se cruzan**.
Se añadió además el módulo de **control de ausentismo**.

Todo lo que sigue ya está implementado y desplegado. Lo que necesita el visto
bueno de Talento Humano está marcado con **⚠️ DECISIÓN**: son puntos donde el
criterio es de ustedes, no del sistema, y donde basta con avisar para que se
ajuste desde Administración sin volver a programar.

---

## 2. Documentos soporte por tipo de permiso

### 2.1 El problema que había

La aplicación sabía *si* hacía falta un soporte, con dos casillas —«al
solicitar» y «al regresar»—, pero nunca supo *cuál*. El colaborador leía
«adjunta el soporte», subía lo que creía, ustedes lo devolvían, y el trámite
daba una vuelta completa por una diferencia que estaba clara desde el principio.

### 2.2 Cómo quedó

Cada motivo tiene ahora una lista de documentos con nombre propio, la norma que
lo respalda y el momento en que se pide. El colaborador ve la lista completa
**antes de enviar**, y al regresar tiene una lista de verificación: la solicitud
solo pasa a validación de Talento Humano cuando no falta ningún documento
obligatorio.

Esto corrige un caso concreto: el **luto** exige registro de defunción **y**
prueba de parentesco. Antes, subir el primero cerraba el paso y ustedes tenían
que devolverlo para pedir el segundo.

### 2.3 Matriz vigente

| Categoría | Motivo | Al solicitar | Al finalizar |
|---|---|---|---|
| Personal | Diligencia personal | — | — |
| Personal | Votaciones | — | Certificado electoral *(obligatorio, 1 mes)* |
| Personal | Deberes de acudiente | — | Constancia de la institución educativa |
| Personal | **Jurado de votación** | Acto de designación *(opcional)* | Certificado electoral |
| Personal | **Citación judicial o administrativa** | Citación de la autoridad | Constancia de comparecencia |
| Personal | **Cargo transitorio de forzosa aceptación** | Acto de designación | Constancia de comparecencia |
| Personal | **Formación o estudio** | Certificado de la institución *(opcional)* | Certificado de la institución |
| Personal | **Permiso no remunerado** | — | — |
| Día de la Familia | Día de la familia | — | — |
| Salud | Cita médica | Orden o cita *(opcional)* | Constancia de asistencia *(solo si supera 2 días)* · Epicrisis *(alternativa)* |
| Salud | Incapacidad médica *(enfermedad general)* | Certificado de incapacidad | Epicrisis *(opcional)* |
| Salud | **Incapacidad por accidente de trabajo** | Certificado de incapacidad | Epicrisis *(opcional)* |
| Salud | **Incapacidad por enfermedad laboral** | Certificado de incapacidad | Epicrisis *(opcional)* |
| Salud | **Licencia de maternidad** | Certificado médico de embarazo | Registro civil de nacimiento |
| Salud | **Licencia de paternidad** | Registro civil de nacimiento | — |
| Salud | **Control prenatal** | — | Constancia de asistencia |
| Salud | **Donación de sangre** | — | Constancia de donación |
| Salud | **Acompañamiento a cita de familiar** | — | Constancia de asistencia |
| Empresarial | Movilidad sostenible | — | — |
| Empresarial | Comisión o actividad institucional | — | — |
| *(trámite propio)* | Retiro parcial de cesantías | Formato de retiro parcial · Soporte de la destinación | — |
| Empresarial | **Comisión sindical** | Comunicación del sindicato | — |
| Empresarial | **Capacitación institucional** | — | — |
| Calamidad | Calamidad doméstica | — | Prueba de la calamidad |
| Calamidad | Luto | — | Registro civil de defunción **y** documento de parentesco |

En **negrita**, los motivos nuevos.

Motivos creados pero **desactivados**, a la espera de que ustedes los enciendan:
licencia parental compartida, licencia parental flexible de tiempo parcial,
licencia por aborto o parto prematuro y licencia por adopción.

> **⚠️ DECISIÓN 1.** ¿Se activan las cuatro licencias parentales? Son derechos
> vigentes (Ley 2114 de 2021 y art. 237 CST), pero conviene encenderlas solo si
> la clínica ya tiene definido cómo las liquida nómina.

> **⚠️ DECISIÓN 2.** Quedó pendiente la conversación sobre los soportes de la
> **cita médica**. Hoy la constancia de asistencia solo es obligatoria si el
> ausentismo supera 2 días, y la epicrisis figura como alternativa opcional.
> Si ustedes prefieren exigir siempre la constancia, es un interruptor.

> **⚠️ DECISIÓN 3.** La epicrisis o resumen de historia clínica es un **dato
> sensible** (Ley 1581 de 2012, art. 5). Se guarda en el bucket privado con
> enlaces que caducan en 60 segundos, pero conviene decidir si se pide de
> entrada o solo cuando la incapacidad no basta.

### 2.4 Plazos de entrega

Antes había un único plazo global de 5 días hábiles para todo. Ahora cada motivo
tiene el suyo, porque los plazos legales no se parecen entre sí:

| Motivo | Plazo | Se cuenta en |
|---|---|---|
| Incapacidades (común, ATEP, enfermedad laboral) | 3 días | Hábiles |
| Cita médica, control prenatal, acompañamiento | 3–5 días | Hábiles |
| Calamidad doméstica, deberes de acudiente | 5 días | Hábiles |
| Certificado electoral (Ley 403 de 1997) | 30 días | Calendario |
| Jurado de votación (Ley 1475 de 2011) | 45 días | Calendario |
| Luto, licencias de maternidad y paternidad | 30 días | Calendario |
| Cargo transitorio de forzosa aceptación | 10 días | Hábiles |
| Retiro parcial de cesantías | 15 días | Hábiles |

La distinción importa: «un mes» no son treinta días hábiles en ninguna norma.
El colaborador ve cuánto le queda, y el aviso cambia a rojo cuando el plazo
vence.

---

## 3. Categorías vs. motivos

### 3.1 Las categorías no cambiaron

Las cinco casillas del TH-F-002 —Personal, Día de la Familia, Salud,
Empresarial y Calamidad— se dejaron intactas: son las que están impresas en el
formato que firma Calidad, y añadir una sexta desalinearía la aplicación del
papel.

> **⚠️ DECISIÓN 4.** Si en algún momento Calidad reedita el formato, valdría la
> pena una casilla **«Licencia de ley»**: hoy el luto vive bajo «Calamidad» y
> las licencias de maternidad y paternidad bajo «Salud», y ninguna de las dos
> es exactamente eso. Mientras tanto se marcan internamente por *naturaleza*.

### 3.2 Qué faltaba

Se completó lo que el art. 57 numeral 6 del CST enumera y la aplicación no
recogía:

- **Desempeño de cargos oficiales transitorios de forzosa aceptación** — no
  existía.
- **Comisiones sindicales** — no existían. No cuentan como ausentismo: es
  tiempo de representación reconocido por la ley.
- **Citación judicial o administrativa** — no existía.
- **Jurado de votación** (Ley 1475 de 2011) — se confundía con votar. Son
  beneficios distintos: media jornada por votar y un día compensatorio por ser
  jurado, y no se acumulan.
- **Incapacidad de origen laboral** — había una sola «Incapacidad médica». El
  Decreto 1072 de 2015 obliga a separar la enfermedad general del accidente de
  trabajo y la enfermedad laboral, que es justo lo que pide la ARL.
- **Licencias parentales** — «Licencia de maternidad o paternidad» era un solo
  motivo para seis licencias con duración y soporte distintos. Con un único
  motivo, el indicador de ausentismo no puede distinguir 18 semanas de 2.
- **Permiso no remunerado**, **formación o estudio** (art. 21 Ley 50 de 1990),
  **donación de sangre** (Ley 1805 de 2016), **control prenatal** y
  **acompañamiento a cita de familiar a cargo**.

### 3.3 Lo que no es un permiso

El **retiro parcial de cesantías** (art. 102 CST, Ley 1071 de 2006) se firma en
este formato y lo aprueba la misma gerencia, pero **no es una ausencia**.
Aparecía en las estadísticas como si el colaborador hubiera faltado, y el
formulario le pedía fecha de inicio, fecha de fin y horas de salida y regreso,
además de advertirle que la solicitud quedaría marcada como extemporánea por no
pedirla con 48 horas de antelación. Nada de eso significa algo aquí.

**Tiene ahora trámite y pantalla propios**, como las vacaciones:

- Numera aparte: `CE-2026-00001`.
- Antelación cero: deja de marcarse extemporánea.
- Pregunta lo que de verdad revisa la Gerencia —destinación, monto y soportes—
  y no pregunta fechas ni horarios.
- No cuenta como ausentismo, no cruza con otros permisos y no se puede
  interrumpir.

Las solicitudes ya radicadas se movieron al trámite nuevo conservando su
consecutivo: renumerarlas rompería la trazabilidad de un documento que ya
circuló firmado.

El mismo criterio aplica a la comisión sindical y a la capacitación
institucional, que siguen siendo permisos pero no cuentan como ausentismo: ahí
el colaborador está cumpliendo una función, no faltando.

> **⚠️ DECISIÓN 5.** ¿Hay otros trámites que deban pasar por este formato sin
> contar como ausencia? Certificaciones laborales, afiliaciones, préstamos. Si
> los hay, cada uno puede tener su propia pantalla o compartir la de cesantías.

> **⚠️ DECISIÓN 5b.** El trámite de cesantías usa el código de formato
> **TH-F-002** porque es lo que Calidad tiene publicado. Si procede pedir un
> formato propio, se cambia desde Administración sin desplegar.

---

## 4. Fechas habilitadas por motivo

### 4.1 El problema

La única regla era «no antes de hoy, salvo calamidad y luto». Con eso:

- Una **incapacidad expedida el viernes no se podía registrar el lunes**.
- Un permiso **para dentro de tres años** se aceptaba sin objeción.

### 4.2 Cómo quedó

Cada motivo declara cuánto admite hacia atrás y hacia adelante, y el calendario
del formulario se acota en consecuencia. A diferencia de la regla de antelación
—que solo advierte—, **esto sí bloquea**: una fecha fuera de rango no es una
solicitud extemporánea, es un dato equivocado.

| Motivo | Hacia atrás | Hacia adelante | Duración máx. | Por horas |
|---|---|---|---|---|
| Incapacidades | 30 días | 30 días | 180 días | No |
| Licencia de maternidad / adopción | 30 días | 300 días | 126 días | No |
| Licencia de paternidad | 30 días | 300 días | 14 días | No |
| Luto | 15 días | 15 días | 5 días | No |
| Calamidad doméstica | 15 días | 15 días | 5 días | Sí |
| Votaciones / jurado | 30 días | 60 días | 1 día | Sí / No |
| Citación judicial · cargo transitorio | 5 días | 180 días | 2 / 5 días | Sí / No |
| Cita médica · control prenatal | 1 día | 180 / 270 días | 1–3 días | Sí |
| Día de la familia | 0 | 180 días | 1 día | No |
| Diligencia personal | 0 | 90 días | 2 días | Sí |
| Permiso no remunerado | 0 | 180 días | 30 días | Sí |

La columna «por horas» resuelve otro detalle: el formulario pedía hora de
salida y de regreso incluso en una licencia de maternidad de 18 semanas, donde
la pregunta no significa nada y además distorsionaba el cálculo de la duración.

### 4.3 Duración y cupo

- La **duración máxima advierte, no bloquea**: la prórroga de una incapacidad
  supera el tope con toda normalidad, y partirla en dos solicitudes haría que
  después nadie supiera que eran la misma.
- El **día de la familia** es semestral (Ley 1857 de 2017, art. 3) y ahora el
  sistema lleva la cuenta. Antes el único control era que alguien se acordara.

> **⚠️ DECISIÓN 6.** ¿Los topes de la tabla son los correctos? En particular:
> ¿cuántos días concede la clínica por calamidad doméstica —la ley no fija un
> número— y cuál es el máximo de un permiso no remunerado?

> **⚠️ DECISIÓN 7.** ¿Hay otros motivos con cupo? Por ejemplo, ¿cuántas citas
> médicas al mes se autorizan sin escalar la decisión?

---

## 5. Permisos que se cruzan

### 5.1 Qué dice la norma

| Situación | Regla aplicada |
|---|---|
| **Incapacidad durante vacaciones** | La incapacidad manda: las vacaciones son descanso y una incapacidad no lo es. El periodo se **suspende** y los días no disfrutados quedan pendientes de reprogramar (art. 187 CST y doctrina reiterada del Ministerio del Trabajo). |
| **Incapacidad durante licencia de luto** | Igual: la licencia no absorbe una incapacidad que aparece dentro de ella. |
| **Calamidad durante vacaciones** | El descanso sigue corriendo. Se registra como antecedente y no parte el periodo, salvo que derive en incapacidad —que es otro motivo—. |
| **Permiso corriente dentro de otro permiso** | No tiene sentido: se avisa como posible error de digitación. |
| **Mismo motivo, mismas fechas** | Se marca como posible duplicado. |

### 5.2 Cómo quedó

Al elegir las fechas, el formulario contrasta el periodo con todo lo que ese
colaborador ya tiene autorizado o en trámite, y explica qué implicaría cada
cruce. **No bloquea el envío**: una incapacidad en mitad de las vacaciones es un
caso legítimo y frecuente; lo que hacía falta es que se vea antes de decidir.

Talento Humano y el jefe directo tienen un botón **«Interrumpir»** en el detalle
de la solicitud. Al usarlo:

1. Se indica el primer día que ya no se disfruta.
2. El sistema calcula los días pendientes con el calendario colombiano
   —festivos y Ley Emiliani—, en hábiles para vacaciones y en calendario para
   licencias e incapacidades.
3. El periodo queda **Suspendido** con el saldo a la vista, y el ausentismo solo
   cuenta hasta el día del corte. Antes se contaban dos veces los mismos días:
   una en las vacaciones y otra en la incapacidad que las partió.
4. Cuando el colaborador vuelve a pedir permiso, se le recuerda que tiene días
   pendientes de reprogramar.

Quien decide sigue siendo Talento Humano. El sistema detecta, propone y deja
constancia; no parte periodos por su cuenta, porque eso tiene efecto en nómina.

> **⚠️ DECISIÓN 8.** La prioridad que decide quién manda en un cruce es
> configurable: incapacidad 30 · luto 20 · calamidad 15 · vacaciones 10 ·
> permiso 0. Hoy una **calamidad sí interrumpe unas vacaciones**. Si ustedes
> consideran que no debería, se baja su prioridad por debajo de 10 desde
> Administración.

> **⚠️ DECISIÓN 9.** ¿La reprogramación de los días pendientes la radica el
> colaborador o la agenda Talento Humano? Hoy el sistema avisa al colaborador;
> el enlace entre el periodo suspendido y el nuevo se puede registrar en los
> dos sentidos.

---

## 6. Módulo de ausentismo

Es una pantalla nueva, **separada del panel ejecutivo**, porque responde a otra
pregunta: el dashboard mide el flujo de solicitudes —cuántas entran, cuánto
tardan— y este mide **tiempo no laborado**.

### 6.1 Qué muestra

- **Indicadores**: días y horas perdidas, porcentaje de tiempo perdido, índice
  de frecuencia e índice de severidad (GTC 3701, base 240.000 horas-hombre),
  duración media por evento y días por causa médica —lo que pide la Resolución
  0312 de 2019—.
- **Cortes**: por colaborador, por proceso o área, por motivo y por cargo, con
  eventos, días, horas, días por causa médica, número de personas y ausencias
  extemporáneas.
- **Gráficos**: evolución mensual, distribución por naturaleza de la ausencia y
  mapa de calor proceso × mes.
- **Filtros**: año, mes, rango de fechas exacto, colaborador (nombre o cédula),
  proceso o área, cargo, empresa, motivo, naturaleza y trámite.
- **Exportación**: detalle completo a Excel, resumen del corte activo a Excel y
  PDF apaisado para imprimir.

### 6.2 Cómo se calculan los índices

El denominador es la **plantilla activa**, no la gente que faltó. Se acota al
área filtrada, para que comparar un servicio contra la plantilla de toda la
clínica no dé un índice engañosamente bajo.

    Horas programadas = colaboradores × meses × días programados al mes × horas de jornada

Los dos últimos valores son parámetros editables en Administración; hoy están en
**24 días al mes** y **8 horas por jornada**.

> **⚠️ DECISIÓN 10.** ¿Son correctos esos dos valores para la clínica? En áreas
> asistenciales con turnos de 12 horas la jornada no es de 8, y eso cambia todos
> los porcentajes. Si hace falta diferenciarlo por área, es un cambio pequeño
> pero conviene decidirlo antes de publicar cifras.

> **⚠️ DECISIÓN 11.** El módulo cuenta **vacaciones** como ausencia. Es correcto
> para medir cobertura del servicio, pero no lo es para un indicador de
> ausentismo por causa médica. Hoy se pueden separar con el filtro de
> naturaleza; si prefieren que las vacaciones no entren por defecto, se cambia.

---

## 7. Resumen de decisiones pendientes

| # | Tema | Qué hay que decidir |
|---|---|---|
| 1 | Licencias parentales | ¿Se activan las cuatro que quedaron apagadas? |
| 2 | Cita médica | ¿Constancia siempre, o solo si supera 2 días? |
| 3 | Historia clínica | ¿Se pide de entrada o solo si la incapacidad no basta? |
| 4 | Categorías | ¿Se pide a Calidad una casilla «Licencia de ley»? |
| 5 | Trámites | ¿Qué otros trámites pasan por el formato sin ser ausencia? ¿Cesantías necesita formato propio de Calidad? |
| 6 | Duraciones | ¿Cuántos días por calamidad y por permiso no remunerado? |
| 7 | Cupos | ¿Algún otro motivo con tope por periodo? |
| 8 | Cruces | ¿La calamidad debe interrumpir las vacaciones? |
| 9 | Reprogramación | ¿Quién radica los días pendientes? |
| 10 | Jornada | ¿24 días y 8 horas valen para turnos de 12? |
| 11 | Ausentismo | ¿Las vacaciones entran por defecto en el indicador? |

Ninguna de estas decisiones exige volver a programar: todas se ajustan desde
**Administración → Motivos de permiso**, **Documentos exigidos** o
**Parámetros**.

---

## 8. Normas consultadas

- **Código Sustantivo del Trabajo**: art. 57 num. 6 y 10 (permisos y licencia de
  luto), arts. 102 (cesantías), 187 (vacaciones), 227 y 228 (incapacidades),
  236, 237 y 239 (licencias de maternidad, aborto y paternidad).
- **Ley 50 de 1990**, art. 21 — actividades formativas dentro de la jornada.
- **Ley 403 de 1997** y **Ley 815 de 2003** — beneficios por ejercer el sufragio.
- **Ley 1071 de 2006** — retiro parcial de cesantías.
- **Ley 1280 de 2009** — licencia de luto, 5 días hábiles.
- **Ley 1475 de 2011**, art. 5 — jurados de votación.
- **Ley 1562 de 2012** y **Decreto 1477 de 2014** — riesgos laborales.
- **Ley 1581 de 2012**, art. 5 — datos sensibles de salud.
- **Ley 1564 de 2012** — comparecencia ante autoridad judicial.
- **Decreto 1072 de 2015** y **Resolución 0312 de 2019** — indicadores del SG-SST.
- **Decreto 780 de 2016** — sistema de salud, incapacidades.
- **Ley 1805 de 2016**, art. 9 — donación de sangre.
- **Ley 1811 de 2016** — incentivos al uso de la bicicleta.
- **Ley 1822 de 2017** y **Ley 2114 de 2021** — licencias parentales.
- **Ley 1857 de 2017**, art. 3 — día de la familia y acompañamiento escolar.
- **Resolución 3280 de 2018** — atención materno perinatal.
- **GTC 3701** — índices de frecuencia y severidad del ausentismo.
- **Ley 51 de 1983** (Ley Emiliani) — traslado de festivos, ya implementada.

---

*Documento generado para revisión interna. Los criterios legales aquí resumidos
orientan la configuración de la aplicación y no sustituyen el concepto jurídico
que corresponda en cada caso concreto.*

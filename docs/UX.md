# Patrones de interfaz

## El requisito que gobierna los formularios

Los formatos de solicitud deben caber **sin scroll vertical**. Verificado a
1280×720, que es la altura más exigente de un portátil habitual.

Eso obliga a que cada elemento justifique su altura. Cuando hubo que añadir el
selector de jefe directo y la cédula, la fila de información general pasó de
tres a cinco columnas en lugar de crecer hacia abajo.

**Cómo se comprueba:**

```js
document.documentElement.scrollHeight - document.documentElement.clientHeight === 0
```

## Panel de resumen en vivo

A la derecha de cada formulario, siguiendo el patrón del proyecto SIAU. Muestra
lo diligenciado, lo que la app calcula y los avisos del caso.

Va deliberadamente más marcado que el resto —cabecera azul, relieve, filas
alternas— porque es la pieza que hay que repasar antes de enviar. Si compite en
peso visual con los campos, se ignora.

## Avisar en vez de bloquear

Las reglas de antelación no impiden enviar: marcan la solicitud como
extemporánea y eso se mide en el dashboard. Lo mismo con los saldos de
vacaciones y con la fecha final ajustada a mano.

El criterio: **la aplicación informa, la persona decide.** Bloquear habría hecho
imposible registrar una calamidad ocurrida ayer, que es un caso real.

Se bloquea solo lo que dejaría el dato inservible: enviar sin motivo, sin jefe
directo, sin cédula o sin aceptar la declaración de vacaciones.

## Tabla estilo Stripe

`TablaSolicitudes` es la misma en bandejas, mis solicitudes y drill-down.

| Función | Detalle |
|---|---|
| Búsqueda inmediata | Atajo `/`, `Esc` limpia |
| Encabezado y filtros sticky | Sobreviven al scroll |
| Orden por columna | Clic en el encabezado |
| Selector de columnas | Cada quien ve lo que necesita |
| Densidad | Compacta / cómoda |
| Filas alternas | Pares e impares diferenciadas |
| Skeleton | Sin saltos de layout al cargar |
| Estado vacío | Distingue «no hay nada» de «no hay resultados» |
| Selección múltiple | Con acciones en lote |
| Paginación | 25 por página |

## Drill-down en el dashboard

Cada tarjeta, celda del mapa de calor y fila del ranking abre la tabla de
solicitudes que hay detrás del dato. Un número sin poder ver qué lo compone
obliga a irse a otra pantalla y filtrar a mano.

## Estados de interfaz

| Estado | Tratamiento |
|---|---|
| Cargando | Skeleton con la forma del contenido |
| Vacío | Icono, explicación y acción sugerida |
| Error | Mensaje en lenguaje llano, sin jerga técnica |
| Sin permiso | Explica que no tiene acceso, no finge que no existe |
| Sin resultados | Diferenciado del vacío, sugiere limpiar el filtro |

Los errores se traducen: `invalid login credentials` se convierte en «El correo
o la contraseña no coinciden».

## Confirmaciones

Toda decisión del flujo pasa por diálogo. **El rechazo exige motivo de al menos
diez caracteres**: es lo que verá el solicitante en el correo y lo que queda en
la auditoría.

## Navegación

Barra lateral fija con el nombre del usuario arriba a la izquierda; al pulsarlo
se despliega *Cerrar sesión* justo debajo. Los enlaces se filtran por rol: nadie
ve opciones que no puede usar.

## Responsive

| Ancho | Comportamiento |
|---|---|
| < 1024 px | Barra lateral colapsable con botón de menú |
| ≥ 1024 px | Barra fija de 18 rem |
| Tablas | Scroll horizontal propio; la página nunca se desplaza en horizontal |
| Formularios | De 5 columnas a 2 y a 1 |

## Animaciones

Sutiles y con propósito: entrada de filas, transición de estado, elevación al
pasar sobre una tarjeta pulsable. `prefers-reduced-motion` las desactiva.

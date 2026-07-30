# Sistema visual

Neumorfismo donde jerarquiza, base plana donde hay que leer. Ver decisión D3 en
[DECISIONS.md](DECISIONS.md).

## Color institucional

| Token | Claro | Uso |
|---|---|---|
| `--cac-azul` | `#0D2D6B` | Franja institucional, botones primarios |
| `--cac-azul-contraste` | `#16468E` | Hover, gradientes, enlaces |

Escala completa `--cac-azul-50` … `--cac-azul-900` para estados y fondos.

## Semánticos por tipo de dato

| Token | Color | Significado |
|---|---|---|
| `--exito` | `#0F9D58` | Aprobado, finalizado |
| `--advertencia` | `#F4B400` | Pendiente, extemporáneo |
| `--error` | `#D93025` | Rechazado, vencido |
| `--info` | `#16468E` | Informativo |
| `--neutro` | `#64748B` | Borrador, archivado |

## Tintes de bloque

Más suaves que los semánticos a propósito: aquellos marcan un estado y deben
saltar a la vista; estos solo agrupan campos y no deben competir con el
contenido.

| Variante | Claro | Oscuro | Dónde |
|---|---|---|---|
| `bloque-azul` | `#f2f6fd` | `#101c31` | Información general |
| `bloque-teal` | `#f0f9f8` | `#0c2321` | Tiempos del permiso |
| `bloque-violeta` | `#f7f5fd` | `#181432` | Motivo, declaración |
| `bloque-ambar` | `#fdf9ef` | `#221c0e` | Justificación, observaciones |
| `bloque-verde` | `#f1f9f4` | `#0e2018` | Compensación |

En modo oscuro **no se limitan a oscurecerse**: tienen valores propios, porque
oscurecer un tinte claro produce grises sucios.

## Clases de componente

| Clase | Efecto |
|---|---|
| `.panel-relieve` | Sombra neumórfica. Metric cards y paneles del dashboard |
| `.bloque-datos` | Tinte + franja de acento a la izquierda. Grupos de formulario |
| `.bloque-titulo` | Título en el color del acento |
| `.tabla-cac` | Filas pares e impares diferenciadas, hover |
| `.franja-institucional` | Gradiente azul de cabeceras y barra lateral |
| `.tabular` | Números tabulares, para que las cifras no bailen |

## Por qué el color es fijo en las metric cards

Al principio el tono dependía del valor: una tarjeta en cero caía a gris, casi
idéntico al fondo de página. Con la base vacía, media retícula era invisible.
Hoy cada métrica tiene color propio por tipo de dato, y el icono va en sólido
para dar peso.

Siete colores distintos entre sí y del fondo, verificado en ambos temas.

## Tipografía y espaciado

Sistema por defecto, sin fuentes externas: GitHub Pages sirve todo estático y
una fuente remota añadiría latencia y una dependencia de terceros.

Densidad compacta en los formularios de solicitud, porque **el requisito es que
quepan sin scroll en 1280×720**. Cada elemento que se añada ahí tiene que
justificar su altura.

## Logos

| Archivo | Uso |
|---|---|
| `logo_cacsb_blanc.png` | Sobre fondo azul: cabeceras, barra lateral, correos |
| `logo_cacsb2.png` | Sobre fondo claro: Excel y PDF |

En los correos el logo se referencia por URL absoluta a producción; en los
archivos exportados se incrusta en base64, porque ni Excel ni pdfmake aceptan
rutas.

## Modo oscuro

Conmutador en la barra lateral, preferencia guardada en `localStorage`. Todas
las variables se redefinen bajo `.dark`. ECharts no hereda variables CSS, así
que el hook `useEsOscuro` le pasa el tema explícitamente.

## Accesibilidad

- Estados de foco visibles en todo control interactivo.
- Los avisos llevan `role="alert"`.
- El estado nunca se comunica solo por color: siempre hay texto o icono.
- El mapa de calor responde al **clic** y no al hover, porque en tablet no hay
  hover.
- `prefers-reduced-motion` desactiva las animaciones.

# Arquitectura

Clean Architecture adaptada a una SPA sobre BaaS. La regla que gobierna todo:
**el dominio no importa nada de React ni de Supabase.**

## Capas

```
presentation/   Páginas, componentes, layouts. Solo pinta y captura eventos.
      ↓
application/    Casos de uso, hooks de TanStack Query, orquestación.
      ↓
domain/         Reglas de negocio puras. Sin dependencias externas.
      ↑
infrastructure/ Cliente Supabase, exportación a Excel y PDF.
```

`domain/` no importa de ninguna otra capa. `infrastructure/` implementa lo que
el dominio necesita del mundo exterior. Todo lo demás depende hacia adentro.

## Por qué importa

No es purismo. En el CI la prueba de dominios de correo falló porque vivía en
`application/auth/registro.ts`, que carga el cliente de Supabase, que revienta
si faltan las variables de entorno. Se movió a `domain/correo.ts` y el problema
desapareció: **lo que es lógica pura se prueba sin credenciales, sin red y sin
navegador.**

Las 60 pruebas unitarias corren en menos de 3 segundos porque casi todas atacan
`domain/`.

## Qué vive en cada capa

### `domain/` — las reglas del negocio

| Módulo | Responsabilidad |
|---|---|
| `estados.ts` | Máquina de estados BPM: transiciones, quién puede hacer qué |
| `festivos.ts` | Calendario colombiano con Ley Emiliani, días hábiles |
| `reglas.ts` | Duración, antelación, exigencia de soporte, saldos |
| `metricas.ts` | Agregaciones del dashboard |
| `correo.ts` | Validación de dominios de correo |

Todo son funciones puras. Ninguna hace `fetch`, ninguna toca el DOM.

### `application/` — orquestación

Hooks de TanStack Query que hablan con Supabase, más el `AuthProvider`. Aquí se
combinan el dominio y la infraestructura para resolver un caso de uso concreto:
crear una solicitud, decidir sobre ella, validar un perfil.

### `infrastructure/` — el mundo exterior

Cliente de Supabase y generadores de Excel y PDF. Ambos se cargan de forma
diferida: ExcelJS y pdfmake pesan 2,3 MB juntos y solo hacen falta al exportar.

### `presentation/` — la interfaz

Páginas, componentes reutilizables y los primitivos de shadcn/ui. `Dashboard`,
`Administracion` y `Validaciones` van con `React.lazy` porque arrastran las
librerías de gráficos.

## Backend

No hay servidor propio. Postgres con RLS es la autoridad de permisos: **el
cliente nunca decide quién ve qué.** Lo que necesita privilegios corre en Edge
Functions con `service_role`.

```
Navegador ──anon key──> Supabase (Postgres + RLS, Auth, Storage)
    │
    └──JWT──> Edge Functions ──service_role──> Postgres
                    └──> Resend
```

| Edge Function | Para qué | JWT |
|---|---|---|
| `permisos-notificar` | Correos del flujo con plantillas institucionales | Sí |
| `permisos-verificar` | Verificación pública del QR del PDF | **No** |
| `permisos-vencimientos` | Marca `VENCIDA` lo que quedó sin decisión | Sí |

`permisos-verificar` es pública a propósito: el QR debe funcionar para quien
tenga el papel en la mano. El código de verificación actúa como capacidad, y la
respuesta omite justificación y soportes.

## Decisiones estructurales

**Filtrado en cliente en el dashboard.** El volumen de una clínica son cientos
de solicitudes al año. Traerlas todas y filtrar en memoria hace que los filtros
respondan al instante, sin ida y vuelta al servidor.

**Tabla común más detalle por trámite.** `permisos_solicitudes` guarda lo que
comparten los dos formatos; `permisos_detalle_permiso` y
`permisos_detalle_vacaciones` añaden lo suyo. Así las bandejas, el dashboard y
los reportes son uno solo, y añadir un tercer formato no toca el motor.

**Sin transacciones desde el cliente.** Al crear una solicitud, si falla la
inserción del detalle se marca la cabecera como borrada. No es tan bueno como
una transacción, pero evita solicitudes huérfanas en las bandejas.

Ver [DECISIONS.md](DECISIONS.md) para el resto, con su motivo.

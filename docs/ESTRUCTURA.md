# Estructura del proyecto

**Código fuente:** `C:\www\permisos_tthh`

68 archivos TypeScript · 10.244 líneas · 17 migraciones · 3 Edge Functions

## Mapa

```
permisos_tthh/
├── .github/workflows/deploy.yml   CI/CD: lint → tipos → pruebas → build → Pages
├── public/images/                 logo_cacsb_blanc.png · logo_cacsb2.png
├── docs/                          Esta documentación + los formatos fuente
├── supabase/
│   ├── migrations/                17 archivos, en orden
│   └── functions/                 permisos-notificar · permisos-verificar
│                                  permisos-vencimientos
└── src/
    ├── domain/                    Reglas puras, sin dependencias
    ├── application/               Casos de uso y hooks
    ├── infrastructure/            Supabase y exportación
    ├── presentation/              Interfaz
    ├── lib/utils.ts               Utilidades transversales
    ├── App.tsx                    Rutas y guardas
    └── index.css                  Variables y clases del sistema visual
```

## `src/domain/` — lógica pura

Ningún archivo aquí importa React ni Supabase. Es lo que hace que las pruebas
corran sin credenciales.

| Archivo | Responsabilidad |
|---|---|
| `estados.ts` | Máquina BPM: 13 estados, transiciones y permisos por rol |
| `festivos.ts` | Calendario colombiano, Ley Emiliani, días hábiles |
| `reglas.ts` | Duración, antelación, soporte obligatorio, saldos |
| `metricas.ts` | Agregaciones del dashboard |
| `correo.ts` | Validación de dominios |
| `__tests__/` | 56 de las 60 pruebas |

## `src/application/` — orquestación

| Carpeta | Contenido |
|---|---|
| `auth/` | `AuthProvider`, registro, creación del perfil en el primer ingreso |
| `catalogos/` | Hooks de catálogos; `useCatalogosRegistro` va por RPC porque no hay sesión |
| `solicitudes/` | API de solicitudes, notificaciones, adjuntos y hooks de consulta |
| `admin/` | Perfiles, roles, CRUD de catálogos, parámetros y auditoría |

## `src/infrastructure/` — el mundo exterior

| Archivo | Notas |
|---|---|
| `supabase/client.ts` | Cliente y `URL_APP`, que se calcula en tiempo de ejecución |
| `export/excel.ts` | ExcelJS con encabezado institucional. Importación diferida |
| `export/pdf.ts` | pdfmake. Lanza error si no encuentra la tipografía, para no fallar en silencio |
| `export/solicitudes.ts` | Mapeo único de columnas, compartido por Excel y PDF |
| `export/logo.ts` | Logo en base64, cacheado |

## `src/presentation/` — interfaz

### Páginas

| Página | Ruta | Quién |
|---|---|---|
| `Login` · `Registro` · `RecuperarClave` · `EstablecerClave` | públicas | — |
| `Verificar` | `/verificar` | Pública, destino del QR |
| `PerfilPendiente` | — | Cuenta sin validar |
| `Inicio` | `/` | Todos |
| `SolicitudPermiso` | `/solicitar/permiso` | Todos |
| `SolicitudVacaciones` | `/solicitar/vacaciones` | Todos |
| `MisSolicitudes` · `DetalleSolicitud` | `/mis-solicitudes` · `/solicitud/:id` | Todos |
| `Bandeja` | `/bandeja/{coordinador,th,gerencia}` | Según rol |
| `Validaciones` | `/validaciones` | TH y administrador |
| `Dashboard` | `/dashboard` | Coordinador y superiores |
| `Administracion` | `/administracion` | Administrador |

`Dashboard`, `Administracion` y `Validaciones` van con `React.lazy`.

### Componentes

| Componente | Se usa en |
|---|---|
| `TablaSolicitudes` | Bandejas, mis solicitudes, drill-down |
| `PanelResumen` | Ambos formularios |
| `MetricCard` · `MapaCalor` · `FiltrosDashboard` | Dashboard |
| `DialogoDecision` | Aprobar, rechazar, cancelar |
| `CampoArchivo` | Adjuntos |
| `admin/` | Editor de catálogos, usuarios, parámetros, auditoría |
| `ui/` | Primitivos de shadcn/ui |

## Tamaño del bundle

Solo React y Supabase se precargan. Lo pesado llega cuando hace falta.

| Chunk | Tamaño | Cuándo se descarga |
|---|---|---|
| `index` | 488 kB | Siempre |
| `supabase` | 220 kB | Siempre |
| `react` | 51 kB | Siempre |
| `Dashboard` | 1,5 MB | Al abrir el panel |
| `exceljs` / `pdfmake` | 2,3 MB | Al exportar |
| `Administracion` | 28 kB | Al entrar a administración |

## Convenciones

- **Todo en español**: nombres de variables, funciones, tablas y comentarios.
- **TypeScript estricto**, sin `any` en el código propio.
- **Comentarios que explican el porqué**, no el qué.
- **Sin componentes de más de ~400 líneas**: si crece, se extrae.
- **Las migraciones que corrigen algo** llevan el motivo en la cabecera.

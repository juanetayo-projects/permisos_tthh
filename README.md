# Permisos y Vacaciones · Clínica CAC Santa Bárbara

Aplicación web que reemplaza los formatos en papel **TH-F-002** (autorización de
permiso laboral) y **TH-F-005** (solicitud de vacaciones) por un flujo digital
con trazabilidad ISO 9001.

**En producción:** https://juanetayo-projects.github.io/permisos_tthh/

---

## Qué resuelve

Un colaborador solicita un permiso o unas vacaciones desde el navegador. La
solicitud llega a la bandeja del jefe directo que él mismo señala, y de ahí a
Talento Humano. Cada paso queda registrado con autor, fecha y hora, y el
documento final se puede verificar por QR sin necesidad de tener cuenta.

| Trámite | Formato | Consecutivo | Ruta de aprobación |
|---|---|---|---|
| Permiso laboral | `TH-F-002 v02` | `PL-2026-00001` | Jefe directo → Talento Humano |
| Vacaciones | `TH-F-005 v02` | `VA-2026-00001` | Jefe directo → Dirección de TH |
| Cesantías | (permiso) | `PL-…` | Directo a Gerencia de TH |

## Stack

React 19 · Vite 6 · TypeScript estricto · Tailwind v4 · shadcn/ui ·
TanStack Query y Table · Recharts y ECharts · ExcelJS y pdfmake ·
Supabase (Postgres, Auth, Storage, Edge Functions) · Resend · GitHub Pages

## Empezar

```bash
npm install
cp .env.example .env   # completa VITE_SUPABASE_ANON_KEY
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | Verificación de tipos |
| `npm run lint` | ESLint |
| `npm run test` | Pruebas unitarias (Vitest) |

## Documentación

| Documento | Contenido |
|---|---|
| [00_ARQUITECTURA_MAESTRA](docs/00_ARQUITECTURA_MAESTRA.md) | Documento aprobado antes de programar: módulos, casos de uso, wireframes |
| [Architecture](docs/Architecture.md) | Capas, dependencias y por qué |
| [Database](docs/Database.md) · [ERD](docs/ERD.md) | Tablas, relaciones y diagrama |
| [API](docs/API.md) | Edge Functions y funciones de base de datos |
| [SECURITY](docs/SECURITY.md) | RLS, auditoría y hallazgos corregidos |
| [DECISIONS](docs/DECISIONS.md) | Cada decisión de diseño y su motivo |
| [UX](docs/UX.md) · [Branding](docs/Branding.md) | Patrones de interfaz y sistema visual |
| [Deploy](docs/Deploy.md) | CI/CD y configuración de entornos |
| [TESTING](docs/TESTING.md) | Qué se prueba y qué no |
| [Roadmap](docs/Roadmap.md) | Lo que queda |
| [CHANGELOG](docs/CHANGELOG.md) | Historial de cambios |
| [ESTRUCTURA](docs/ESTRUCTURA.md) | Mapa de carpetas y archivos |
| [SUPER_PROMPT](docs/SUPER_PROMPT.md) | Especificación completa para reconstruir o continuar |
| [plantillas_correo_auth](docs/plantillas_correo_auth.md) | Plantillas de Supabase Auth para pegar en el panel |

> ⚠️ **La base de datos se comparte con Cambio de Turnos.** Las tablas de esta
> app llevan el prefijo `permisos_`; `areas`, `cargos` y `coordinadores` son
> comunes a las dos aplicaciones. Ver [DECISIONS.md](docs/DECISIONS.md), D2.

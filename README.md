# PERMISOS TTHH — Clínica CAC Santa Bárbara

Aplicación empresarial para la gestión de **permisos laborales** y **vacaciones**
del personal, en reemplazo del proceso manual en papel.

Digitaliza dos formatos del proceso de Talento Humano:

| Trámite | Formato | Antelación mínima |
|---|---|---|
| Autorización de permiso laboral | `TH-F-002 V02` | 48 horas |
| Solicitud y autorización de vacaciones | `TH-F-005 V02` | 20 días |

## Estado

🚧 **En desarrollo.** La arquitectura está aprobada y documentada en
[`docs/00_ARQUITECTURA_MAESTRA.md`](docs/00_ARQUITECTURA_MAESTRA.md).

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 · Vite 6 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui |
| Formularios | React Hook Form · Zod |
| Datos | TanStack Query · TanStack Table |
| Gráficos | Recharts · ECharts (mapa de calor) |
| Exportación | ExcelJS · pdfmake |
| Backend | Supabase — PostgreSQL · Auth · Storage · Realtime · Edge Functions |
| Correo | Resend |
| Despliegue | GitHub Actions → GitHub Pages |

## Flujo de aprobación

```
Colaborador → Jefe directo (coordinador) → Dirección de Talento Humano → Archivada
```

Las **solicitudes de cesantías** saltan al coordinador y llegan directamente a la
bandeja de la Gerencia de Talento Humano.

## Roles

`colaborador` · `coordinador` · `analista_th` · `gerente_th` · `administrador`

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar con las claves de Supabase
npm run dev
```

## Documentación

Toda la documentación técnica vive en [`docs/`](docs/). El documento maestro de
arquitectura recoge modelo de datos, casos de uso, wireframes, riesgos y
decisiones tomadas.

## Seguridad

- Autenticación y RLS obligatorios: los soportes de permisos contienen datos de
  salud y están sujetos a la **Ley 1581 de 2012** (habeas data).
- Ninguna clave ni contraseña se versiona: el cliente solo usa la `anon key` de
  Supabase; todo lo privilegiado corre en Edge Functions.
- Trazabilidad ISO 9001 de cada acción (usuario, fecha, hora, IP, antes/después).

---

Clínica de Alta Complejidad Santa Bárbara · Proceso de Talento Humano

# MASTER_SPECIFICACION_PERMISISOS_TTHH

> Documento consolidado basado exclusivamente en los archivos
> `concepto_general.txt` y `prompt_inicial.txt`.

## Objetivo

Construir una aplicación empresarial para la gestión integral de
permisos y ausentismos de la Clínica de Alta Complejidad Santa Bárbara,
reemplazando el proceso manual, con arquitectura escalable, mantenible y
preparada para auditorías ISO 9001.

## Consolidación

Este documento unifica los requerimientos funcionales y técnicos
presentes en ambos archivos fuente.

### Arquitectura

-   Next.js 15
-   React 19
-   TypeScript
-   Tailwind
-   shadcn/ui
-   React Hook Form
-   Zod
-   TanStack Table
-   TanStack Query
-   Framer Motion
-   Supabase (PostgreSQL, Auth, Storage, Realtime)
-   GitHub + GitHub Actions
-   Resend
-   Clean Architecture
-   SOLID
-   DDD donde aplique

### Objetivos funcionales

-   Gestión de solicitudes de permisos.
-   Flujo de aprobación por Coordinador y Talento Humano.
-   Reportes PDF/Excel.
-   Dashboard ejecutivo.
-   Auditoría.
-   Seguridad por roles.

### Flujo BPM

BORRADOR → ENVIADA → PENDIENTE COORDINADOR → APROBADA COORDINADOR →
PENDIENTE TALENTO HUMANO → APROBADA TH → FINALIZADA → ARCHIVADA.

También contempla estados de rechazo, cancelación y vencimiento.

### Reglas destacadas

-   Adjuntos opcionales.
-   Notificaciones por correo.
-   Registro de auditoría.
-   Preparación para IA.
-   Diagramas Mermaid.
-   Documentación técnica en `/docs`.

## Observaciones de consolidación

Los dos documentos son complementarios. Se identificó una diferencia de
lineamientos visuales: uno solicita una experiencia inspirada en
Linear/Stripe/Notion/Odoo/Vercel y el otro menciona Neumorfismo.
Conviene definir un único estilo visual antes del desarrollo.

## Nota

Este archivo es una consolidación inicial. Un documento maestro completo
con todos los casos de uso, modelo de datos, wireframes, historias de
usuario y especificaciones detalladas tendría una extensión mucho mayor.

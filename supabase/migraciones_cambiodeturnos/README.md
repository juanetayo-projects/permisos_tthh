# Migraciones que se aplicaron al proyecto de Cambio de Turnos

Lo que hay aquí **no se replica** en el proyecto de Permisos: son cambios que
esta aplicación tuvo que hacer sobre la base de datos de *otra*, mientras las
dos compartieron proyecto Supabase (decisión D2, del 2026-07-29 al 2026-08-02).

Están fuera de `supabase/migrations/` a propósito. Al separarse los proyectos,
una reproducción del esquema desde cero fallaría al llegar a ellas: la tabla
`solicitudes` que endurecen no existe —ni debe existir— en Permisos.

Se conservan porque son el registro de un cambio real hecho en producción sobre
un sistema vivo, y borrarlas dejaría ese cambio sin explicación en el
repositorio que lo originó.

| Archivo | Qué hizo |
|---|---|
| `20260729001000_cambiodeturnos_endurecer_sol_insert.sql` | La policy `sol_insert` de Cambio de Turnos permitía a un usuario de Permisos insertar solicitudes por API. Se endureció exigiendo fila en `profiles`. Es el incidente que mejor justifica haber separado los proyectos. |

# Super prompt · Permisos y Vacaciones TTHH

Especificación consolidada para reconstruir la aplicación desde cero o
continuarla. Recoge el prompt inicial más todo lo que se decidió, se corrigió y
se aprendió durante el desarrollo.

---

## Contexto

Clínica de Alta Complejidad Santa Bárbara (Colombia). Talento Humano gestiona en
papel dos formatos y quiere digitalizarlos con trazabilidad ISO 9001:

- **TH-F-002 v02** — Autorización de permiso laboral
- **TH-F-005 v02** — Solicitud y autorización de vacaciones

Los formatos originales están en `docs/plantilla_permisos.xlsx` y
`docs/plantilla_vacaciones.xlsx`. **Respeta su estructura de campos**: son
documentos controlados por Calidad.

Multiempresa: CAC Santa Bárbara, GE2 y Geriater.

## Stack

React 19 · Vite 6 · TypeScript estricto · Tailwind v4 · shadcn/ui ·
TanStack Query y Table · Recharts (gráficos) · ECharts (mapa de calor) ·
ExcelJS y pdfmake · Supabase · Resend · GitHub Pages

**No uses Next.js**: GitHub Pages no sirve SSR.

## Arquitectura

Clean Architecture con una regla que no se negocia: **`domain/` no importa nada
de React ni de Supabase**. Las reglas de negocio deben probarse sin
credenciales, sin red y sin navegador.

```
presentation → application → domain ← infrastructure
```

Postgres con RLS es la autoridad de permisos. El cliente solo lleva la clave
anónima; lo privilegiado va en Edge Functions con `service_role`.

## Modelo de datos

Cabecera común `permisos_solicitudes` + detalle por trámite
(`permisos_detalle_permiso`, `permisos_detalle_vacaciones`). Así bandejas,
dashboard y reportes son uno solo y añadir un tercer formato no toca el motor.

Ver [ERD.md](ERD.md) y [Database.md](Database.md).

## Flujo

```
BORRADOR → PENDIENTE_COORDINADOR → PENDIENTE_TH → FINALIZADA → ARCHIVADA
                                 ↘ PENDIENTE_SOPORTE ↗
   cesantías ↘ PENDIENTE_GERENCIA_TH → FINALIZADA
   rechazos  → RECHAZADA_COORDINADOR / RECHAZADA_TH
   otros     → CANCELADA / VENCIDA
```

Cinco roles: `colaborador`, `coordinador`, `analista_th`, `gerente_th`,
`administrador`.

## Reglas de negocio que no son evidentes

Esto es lo que costaría descubrir de nuevo:

1. **Las reglas de antelación avisan, no bloquean.** 48 h en permisos, 20 días
   en vacaciones. Los propios ejemplos del cliente las incumplen. Marca la
   solicitud como `extemporanea` y mídelo en el dashboard.

2. **Calamidad y luto pueden pedirse con fecha pasada.** Ocurren de un momento a
   otro. El calendario bloquea días pasados salvo en motivos marcados
   `exento_antelacion`.

3. **Vacaciones se cuenta en días hábiles de lunes a viernes**, excluyendo
   festivos colombianos con Ley Emiliani. Verificado contra el formato: 6 días
   desde el 2-ene-2026 terminan el 9, con reintegro el 13.

4. **El 13 de junio es festivo desde 2026, trasladable.** En 2026 cae sobre el
   Sagrado Corazón, así que no aporta día libre; en 2027 sí.

5. **El solicitante elige su jefe directo.** Deducirlo del perfil falla con quien
   cambió de servicio. Propón el del servicio elegido, pero deja cambiarlo.

6. **Una persona puede coordinar varios servicios**: una fila por servicio en
   `coordinadores`. No son duplicados. Muestra el cargo en los desplegables o
   las opciones se ven idénticas.

7. **Cita médica de más de 2 días exige soporte al regresar.** La solicitud pasa
   a `PENDIENTE_SOPORTE` con fecha límite; TH no puede archivarla sin el
   documento.

8. **Las cesantías saltan al jefe directo** y van a Gerencia de TH.

9. **`PENDIENTE_SOPORTE` cuenta como aprobada** en métricas: el permiso ya se
   disfrutó.

10. **Los saldos de vacaciones se digitan y TH los valida** contra nómina. La app
    calcula los días hábiles en paralelo y avisa si no cuadran, sin bloquear.

11. **Muchos colaboradores no tienen correo institucional.** El registro acepta
    cualquier dominio; el control es la validación de TH.

12. **Los catálogos se desactivan, no se borran**: hay solicitudes históricas
    que los referencian.

## Requisitos de interfaz

- **Los dos formularios deben caber sin scroll vertical en 1280×720.** Mide
  `scrollHeight - clientHeight` para comprobarlo. Cada elemento nuevo tiene que
  justificar su altura.
- **Panel de resumen en vivo** a la derecha, más marcado que el resto.
- **Cada grupo de campos con tinte propio** y franja de acento; en modo oscuro
  los tintes se redefinen, no se oscurecen.
- **Metric cards con color fijo por tipo de dato**, no dependiente del valor: en
  cero caerían a gris invisible.
- **Nombre del usuario arriba a la izquierda**, con cerrar sesión desplegándose
  debajo.
- **Barra lateral fija**, no `sticky`: con `sticky` la franja mide una pantalla y
  al bajar asoma el fondo.
- **Tabla estilo Stripe**: búsqueda con atajo `/`, sticky, orden, selector de
  columnas, densidad, skeleton, acciones en lote.
- **Drill-down en el dashboard**: cada dato abre las solicitudes que hay detrás.
- **Mapa de calor con clic**, no hover: en tablet no hay hover.

## Trampas técnicas encontradas

Cosas que costaron tiempo y no son obvias:

- **`gen_random_bytes` vive en el esquema `extensions`.** Una función
  `SECURITY DEFINER` con `search_path = public` no lo encuentra. Califica el
  esquema; no amplíes el `search_path`.
- **La auditoría genérica necesita saber la clave de cada tabla.** Las tablas de
  detalle usan `solicitud_id`, no `id`.
- **Un solo emisor de eventos.** Si el trigger de historial también emite,
  cada cambio se registra dos veces.
- **`manualChunks` provoca `modulepreload`.** No declares ahí las librerías que
  solo usa una ruta diferida.
- **pdfmake falla en silencio sin `vfs`.** Lanza un error explícito si no lo
  encuentra.
- **Quien se registra no tiene sesión.** Los catálogos del formulario necesitan
  una RPC `SECURITY DEFINER` para `anon`.
- **Los correos de confirmación y recuperación son de Supabase Auth**, no de la
  app. Sus plantillas se pegan a mano en el panel.
- **PostgREST devuelve 200 con `[]` si el embed es válido y 400 si es ambiguo.**
  Sirve para validar consultas sin datos.

## Compartir base de datos con otra aplicación

Si reutilizas un proyecto Supabase existente, cuenta con esto:

- `auth.users` es común: quien tiene cuenta en una app entra a la otra.
- Revisa que la otra aplicación no dé acceso por el mero hecho de estar
  autenticado.
- Cualquier ajuste de Auth afecta a ambas: plantillas, URLs de redirección,
  políticas de contraseña.
- Si el administrador de la app nueva debe editar catálogos compartidos, sus
  policies apuntarán a la tabla de perfiles de la app original.

## Qué verificar antes de dar algo por terminado

No basta con que compile:

1. **Crea una solicitud real de punta a punta.** Dos fallos bloqueantes
   aparecieron solo al insertar.
2. **Mide el scroll** de los formularios a 1280×720.
3. **Lee los colores computados** en ambos temas y comprueba que se distinguen.
4. **Previsualiza los correos** sin enviarlos y revisa que los enlaces apunten a
   producción, no a localhost.
5. **Ejecuta las pruebas sin `.env`** para reproducir el CI.
6. **Comprueba qué se precarga** en `index.html` tras compilar.

## Entregables

- Código fuente en el repositorio, con CI/CD que despliegue solo si pasa todo.
- Migraciones versionadas, con el motivo en la cabecera de las que corrigen algo.
- Documentación en `/docs`.
- Usuario administrador inicial **sin manejar contraseñas en texto plano**:
  enlace de establecimiento por correo.

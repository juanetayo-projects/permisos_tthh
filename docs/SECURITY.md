# Seguridad

## Principio

**Postgres es la autoridad, no el cliente.** Toda tabla tiene RLS activo y el
navegador solo lleva la clave anónima. Lo que necesita privilegios corre en Edge
Functions con `service_role`, que nunca sale del servidor.

Si mañana alguien llama a la API REST con la clave anónima y un token de sesión
cualquiera, las policies deciden qué ve. La interfaz no es la que protege.

## Quién ve qué

| Rol | Solicitudes que ve |
|---|---|
| `colaborador` | Las suyas |
| `coordinador` | Las suyas + donde es el jefe elegido + las de su área |
| `analista_th` | Todas |
| `gerente_th` | Todas, incluidas cesantías |
| `administrador` | Todas + catálogos + auditoría |

La visibilidad del coordinador se resuelve con `permisos_es_jefe_de(coordinador_id, area_id)`,
que reconoce **al jefe señalado en la solicitud** y también a quien coordine el
área. Lo segundo evita que una solicitud sin jefe asignado quede sin dueño.

## Reglas que impone la base de datos

- **Nadie se autoproclama administrador.** La policy de inserción de perfiles fija
  por contrato `rol = 'colaborador'` y `estado = 'pendiente_validacion'`.
- **Talento Humano valida, pero no asigna roles.** `permisos_perfiles_th` exige
  que `rol` no cambie. Solo el administrador puede tocarlo.
- **Nada se borra.** `DELETE` está revocado en solicitudes; se usa `deleted_at`.
- **La auditoría es inmutable.** `UPDATE` y `DELETE` revocados en
  `permisos_auditoria`, incluso para el administrador.
- **Los adjuntos son privados.** Bucket `soportes-permisos` sin acceso público;
  se sirven por URL firmada de 60 segundos, porque pueden contener datos de
  salud (Ley 1581).

## Hallazgos corregidos

Todos se encontraron probando, no revisando código.

### Escalamiento de privilegios en perfiles
`permisos_perfiles_th` permitía a un `analista_th` cambiar **cualquier** columna
de cualquier perfil, incluido `rol`. Un analista podía otorgarse `administrador`.
Corregido en la migración 012: la policy exige que `rol` permanezca igual.

### Inserción sin perfil en Cambio de Turnos
Al compartir `auth.users`, un usuario que solo pertenece a Permisos podía crear
por API una solicitud de cambio de turno, porque `sol_insert` solo exigía
`solicitante_id = auth.uid()`. Corregido en la migración 010 exigiendo fila en
`profiles`. Se comprobó **existencia** y no `activo`, para no alterar el
comportamiento del único perfil inactivo que existe.

### `search_path` y funciones con privilegios
Todas las funciones `SECURITY DEFINER` declaran `set search_path = public`. El
trigger del consecutivo llamaba a `gen_random_bytes`, que vive en el esquema
`extensions`, y fallaba. Se calificó el esquema **sin ampliar el search_path**:
mantenerlo acotado es justo lo que impide que alguien anteponga un esquema
propio y secuestre la resolución de nombres.

### Catálogos del registro
Quien se registra no tiene sesión, y las policies de los catálogos exigen
`authenticated`. En vez de abrir las tablas al rol `anon` —`areas` y `cargos`
son de Cambio de Turnos— se expuso `permisos_catalogos_registro()`, que devuelve
solo `id` y `nombre`. Ningún dato de personas.

### Verificación pública del QR
`permisos-verificar` es la única función sin JWT. El código de verificación
—18 caracteres hexadecimales aleatorios— actúa como capacidad: sin conocer
consecutivo **y** código no se obtiene nada. La respuesta omite justificación,
observaciones y soportes.

## Ampliación de privilegio deliberada

El administrador de Permisos puede editar `areas`, `cargos` y `coordinadores`,
que son de Cambio de Turnos (migración 018). Sin eso no podría dar de alta un
jefe directo ni asociarlo a un servicio, que es lo que hace que las solicitudes
lleguen a la bandeja correcta. La pantalla lo avisa.

## Avisos del linter que no son hallazgos

El linter de Supabase marca las funciones `SECURITY DEFINER` ejecutables por
`authenticated`. Las funciones predicado de RLS —`permisos_es_th()`,
`permisos_es_jefe_de()`, etc.— **deben** serlo: sin ese permiso las policies no
se evaluarían. No son un problema.

## Configuración fuera del repositorio

| Ajuste | Dónde | Estado |
|---|---|---|
| Protección de contraseñas filtradas | Authentication → Sign In / Providers → Email | ✅ Activo |
| URLs de redirección | Authentication → URL Configuration | ✅ Ambas apps |
| Plantillas de correo de Auth | Authentication → Emails | ⏳ Pendiente de pegar |
| `RESEND_API_KEY` | Supabase Vault | ✅ Compartida |

## Pendiente

- **MFA**: Supabase lo soporta; no está habilitado.
- **Rate limiting propio** en Edge Functions: hoy se confía en el de Supabase.
- **Registro de IP** en auditoría: la columna existe pero no se llena, porque el
  cliente no puede afirmar su propia IP de forma fiable. Requiere capturarla en
  una Edge Function.

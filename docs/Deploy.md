# Despliegue

**Producción:** https://juanetayo-projects.github.io/permisos_tthh/
**Repositorio:** https://github.com/juanetayo-projects/permisos_tthh

## Cómo se publica

Cada `push` a `main` dispara `.github/workflows/deploy.yml`, en tres fases
encadenadas: si una falla, no se despliega nada.

```
verificar → compilar → desplegar
  lint       build       Pages
  typecheck  (secretos)
  test
```

El despliegue no cancela el que ya esté corriendo: dejar Pages a medias es peor
que esperar unos segundos.

## Secretos del repositorio

**Settings → Secrets and variables → Actions**

| Secreto | Valor |
|---|---|
| `VITE_SUPABASE_URL` | `https://rykondrasrvnuurolqqk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima del proyecto |

Solo la clave anónima llega al navegador. Todo lo privilegiado vive en Edge
Functions con `service_role`, que nunca sale del servidor.

## Configuración de GitHub Pages

Origen **GitHub Actions**, no rama. Se habilitó con:

```bash
gh api --method POST repos/juanetayo-projects/permisos_tthh/pages -f build_type=workflow
```

## Por qué HashRouter

GitHub Pages devuelve 404 en cualquier ruta que no corresponda a un archivo. Con
`HashRouter` las rutas van tras `#` y el servidor solo ve `index.html`. El
workflow copia además `index.html` a `404.html` por si alguien entra por una URL
sin almohadilla.

Consecuencia: todos los enlaces de los correos llevan `#`. Al cambiar una ruta,
hay que revisar `permisos-notificar`.

## Configuración en Supabase

Fuera del repositorio, se hace una sola vez.

| Ajuste | Dónde |
|---|---|
| URLs de redirección | Authentication → URL Configuration |
| Contraseñas filtradas | Authentication → Sign In / Providers → Email |
| Plantillas de correo | Authentication → Emails · ver [plantillas_correo_auth.md](plantillas_correo_auth.md) |
| `RESEND_API_KEY` | Supabase Vault |

> ⚠️ **Estos ajustes son del proyecto compartido con Cambio de Turnos.** Al
> tocarlos, se afecta a las dos aplicaciones. En Redirect URLs deben convivir:
>
> ```
> https://juanetayo-projects.github.io/cambiodeturnos/**
> https://juanetayo-projects.github.io/permisos_tthh/**
> ```

## Migraciones

Los archivos de `supabase/migrations/` están en el repositorio pero **no se
aplican solas**: se ejecutan contra el proyecto y se versionan a continuación.
El workflow no toca la base de datos, a propósito: un despliegue de front no
debería poder alterar el esquema.

## Edge Functions

Se despliegan aparte del front. El código está en `supabase/functions/`.

## Reconstruir en otro servidor

1. Clonar el repositorio.
2. Crear un proyecto Supabase y aplicar las 17 migraciones en orden.
3. Crear el bucket privado `soportes-permisos`.
4. Desplegar las tres Edge Functions.
5. Guardar `RESEND_API_KEY` en el Vault.
6. Configurar `.env` con la URL y la clave anónima del proyecto nuevo.
7. Ajustar `base` en `vite.config.ts` si la ruta pública cambia.
8. Actualizar `APP_URL` en `permisos-notificar`.

El paso 7 es fácil de olvidar: si la app no cuelga de `/permisos_tthh/`, los
recursos no cargarán.

## Verificar un despliegue

```bash
gh run list --limit 1
curl -s "https://rykondrasrvnuurolqqk.supabase.co/functions/v1/permisos-verificar?c=X&v=Y"
```

Y en el navegador: que el login cargue sin errores en consola y que el registro
muestre las empresas y áreas —eso confirma que la conexión a Supabase funciona
con los secretos del build.

# Pruebas

**60 pruebas unitarias**, todas en verde, en menos de 3 segundos.

```bash
npm run test          # una pasada
npm run test:watch    # en vigilancia
npm run typecheck     # tipos
npm run lint          # ESLint
```

## Qué se prueba

| Archivo | Pruebas | Cubre |
|---|---|---|
| `domain/__tests__/festivos.test.ts` | 14 | Ley Emiliani, días hábiles, fecha final por días hábiles |
| `domain/__tests__/reglas.test.ts` | 15 | Duración, antelación, soporte obligatorio, saldos |
| `domain/__tests__/metricas.test.ts` | 15 | KPIs, tendencia, ranking, mapa de calor |
| `domain/__tests__/estados.test.ts` | 12 | Máquina de estados y permisos por rol |
| `application/auth/__tests__/registro.test.ts` | 4 | Validación de dominios de correo |

Casi todo ataca `domain/`, que es lógica pura: sin red, sin navegador y sin
credenciales. Por eso son rápidas y por eso no se rompen al cambiar la interfaz.

## Casos que existen porque el negocio los tiene

No son pruebas de cobertura, sino de reglas que costaría descubrir de nuevo:

- **El 13 de junio se traslada por Ley Emiliani**, y en 2026 cae sobre el
  Sagrado Corazón, así que ese año no aporta ningún día libre. En 2027 sí.
- **15 días hábiles desde el 2-ene-2026 terminan el 23**, con reintegro el 26.
  Verificado contra el ejemplo real del formato TH-F-005.
- **`PENDIENTE_SOPORTE` cuenta como aprobada** en las métricas: el permiso ya se
  disfrutó, lo que falta es el papel.
- **La tasa de aprobación ignora lo pendiente**, o una bandeja llena la
  desplomaría sin que nadie hubiera rechazado nada.
- **Las cesantías saltan al coordinador** y van directo a gerencia.
- **Nadie cancela una solicitud ajena**, ni siquiera el administrador.
- **El mapa de calor devuelve ceros explícitos**: un hueco se lee como «sin
  datos» y un cero significa «ninguna solicitud», que es información distinta.

## Verificación en el navegador

Lo que no cubren las pruebas unitarias se comprobó manualmente contra la
aplicación real, y así se encontraron los defectos que registra el
[CHANGELOG](CHANGELOG.md):

| Qué | Cómo |
|---|---|
| Sin scroll en los formatos | Medir `scrollHeight - clientHeight` a 1280×720 |
| Colores diferenciados | Leer `getComputedStyle` de cada bloque en ambos temas |
| Consultas de PostgREST | Llamar al endpoint: 200 con `[]` prueba que el embed es válido; 400 delata ambigüedad |
| Exportación | Interceptar `URL.createObjectURL` para medir el archivo sin escribir en disco |
| Correos | Modo `preview` de la Edge Function: devuelve el HTML sin enviar |
| Flujo completo | Crear solicitudes de prueba en base, verificar y borrarlas |

## Lo que no está probado

Honestamente:

- **Sin pruebas de componentes.** Testing Library está instalado, no usado.
- **Sin E2E.** Playwright está configurado, sin escenarios escritos.
- **Sin pruebas de RLS automatizadas.** Las policies se verificaron a mano con
  sesiones reales. Es la brecha más importante: un cambio de policy podría
  abrir acceso indebido y ninguna prueba lo detectaría.
- **Sin pruebas de las Edge Functions.**

## Lo primero que habría que añadir

1. **RLS**: un colaborador no ve solicitudes ajenas; un coordinador de otra área
   tampoco; un `analista_th` no puede cambiar roles.
2. **E2E del flujo**: solicitar → autorizar → visto bueno → verificar el QR.
3. **Componentes**: que los formularios no dejen enviar sin motivo ni jefe.

## Integración continua

Cada `push` corre lint, tipos y pruebas antes de compilar. Si algo falla, no se
despliega. La primera ejecución falló de verdad y sirvió: destapó que una prueba
de dominio arrastraba el cliente de Supabase, que exige credenciales inexistentes
en CI. Se corrigió moviendo la lógica pura a `domain/`.

Para reproducir el entorno del CI en local, basta con esconder el `.env`:

```bash
mv .env .env.bak && npm run test; mv .env.bak .env
```

# Modelo de datos

## Diagrama

```mermaid
erDiagram
    auth_users ||--|| permisos_perfiles : "1:1"
    permisos_empresas ||--o{ permisos_perfiles : emplea
    areas ||--o{ permisos_perfiles : "pertenece a"
    cargos ||--o{ permisos_perfiles : desempena
    coordinadores ||--o{ permisos_perfiles : "jefe por defecto"

    permisos_perfiles ||--o{ permisos_solicitudes : solicita
    permisos_tramites ||--o{ permisos_solicitudes : tipifica
    coordinadores ||--o{ permisos_solicitudes : "autoriza"
    areas ||--o{ permisos_solicitudes : "servicio"
    permisos_empresas ||--o{ permisos_solicitudes : "empresa"

    permisos_categorias ||--o{ permisos_tipos : agrupa
    permisos_tipos ||--o{ permisos_detalle_permiso : clasifica
    permisos_categorias ||--o{ permisos_detalle_permiso : "casilla del formato"

    permisos_solicitudes ||--o| permisos_detalle_permiso : "TH-F-002"
    permisos_solicitudes ||--o| permisos_detalle_vacaciones : "TH-F-005"
    permisos_solicitudes ||--o{ permisos_adjuntos : soporta
    permisos_solicitudes ||--o{ permisos_historial : traza
    permisos_solicitudes ||--o{ permisos_notificaciones : notifica
    permisos_solicitudes ||--o{ permisos_eventos : emite

    permisos_consecutivos {
        text prefijo PK
        int anio PK
        int ultimo
    }
    permisos_auditoria {
        bigint id PK
        text tabla
        text registro_id
        text accion
        jsonb datos_antes
        jsonb datos_despues
    }
    permisos_config {
        text clave PK
        jsonb valor
    }
```

`permisos_auditoria`, `permisos_config` y `permisos_consecutivos` no tienen
relaciones formales: la primera registra cualquier tabla por nombre, la segunda
guarda parámetros sueltos y la tercera lleva el contador por prefijo y año.

## Tablas compartidas con Cambio de Turnos

Estas **no** llevan prefijo porque pertenecen a la otra aplicación. Permisos las
lee siempre y las escribe solo desde Administración.

| Tabla | Filas | Uso aquí |
|---|---|---|
| `areas` | 16 | Servicio del colaborador y de la solicitud |
| `cargos` | 17 | Cargo del colaborador |
| `coordinadores` | 23 | Jefes directos que pueden autorizar |
| `auth.users` | — | Autenticación común a ambas apps |
| `profiles` | 24 | Solo lectura, para importar personas a Permisos |

> Una persona que coordina varios servicios tiene **una fila por servicio** en
> `coordinadores`. No son duplicados.

## Flujo de estados

```mermaid
stateDiagram-v2
    [*] --> BORRADOR
    BORRADOR --> PENDIENTE_COORDINADOR : enviar
    BORRADOR --> PENDIENTE_GERENCIA_TH : enviar (cesantías)
    BORRADOR --> CANCELADA

    PENDIENTE_COORDINADOR --> PENDIENTE_TH : autoriza el jefe
    PENDIENTE_COORDINADOR --> RECHAZADA_COORDINADOR : rechaza + motivo
    PENDIENTE_COORDINADOR --> CANCELADA : cancela el solicitante
    PENDIENTE_COORDINADOR --> VENCIDA : pasó la fecha sin decisión

    PENDIENTE_TH --> PENDIENTE_SOPORTE : VoBo, falta soporte
    PENDIENTE_TH --> FINALIZADA : VoBo
    PENDIENTE_TH --> RECHAZADA_TH : rechaza + motivo

    PENDIENTE_GERENCIA_TH --> FINALIZADA : aprueba gerencia
    PENDIENTE_GERENCIA_TH --> RECHAZADA_TH : rechaza + motivo

    PENDIENTE_SOPORTE --> FINALIZADA : TH valida el soporte
    FINALIZADA --> ARCHIVADA
    RECHAZADA_COORDINADOR --> ARCHIVADA
    RECHAZADA_TH --> ARCHIVADA
    CANCELADA --> ARCHIVADA
    VENCIDA --> ARCHIVADA
    ARCHIVADA --> [*]
```

`PENDIENTE_SOPORTE` cuenta como aprobada en las métricas: el permiso ya se
disfrutó, lo que falta es el papel.

## Quién ve qué

```mermaid
flowchart TD
    S[Solicitud] --> P{¿Quién consulta?}
    P -->|El solicitante| V1[Ve la suya]
    P -->|Jefe elegido en la solicitud| V2[Ve y decide]
    P -->|Coordina el área| V3[Ve y decide]
    P -->|analista_th / gerente_th| V4[Ve todas]
    P -->|Otro colaborador| V5[No ve nada]
```

Se reconoce al jefe **elegido en la solicitud** y también a quien coordine el
área, para que las solicitudes antiguas sin jefe asignado no queden huérfanas.
Ver [SECURITY.md](SECURITY.md).

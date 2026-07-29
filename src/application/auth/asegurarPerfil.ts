import type { User } from '@supabase/supabase-js'
import { supabase } from '@/infrastructure/supabase/client'

/**
 * Crea el perfil de Permisos en el primer inicio de sesión.
 *
 * Al registrarse, los datos quedaron en `user_metadata` porque todavía no
 * había sesión. Aquí ya la hay, así que la policy `permisos_perfiles_insert_propio`
 * permite la inserción — y fija por contrato `rol = colaborador` y
 * `estado = pendiente_validacion`, de modo que nadie puede autoproclamarse
 * administrador manipulando el cliente.
 *
 * Devuelve `true` si creó la fila.
 */
export async function asegurarPerfil(user: User): Promise<boolean> {
  const meta = user.user_metadata ?? {}
  if (!meta.nombre) return false // Usuario creado por otra vía: lo resuelve Talento Humano.

  const { error } = await supabase.from('permisos_perfiles').insert({
    user_id: user.id,
    nombre: String(meta.nombre),
    correo: user.email ?? '',
    tipo_documento: meta.tipo_documento ? String(meta.tipo_documento) : 'CC',
    documento: meta.documento ? String(meta.documento) : null,
    telefono: meta.telefono ? String(meta.telefono) : null,
    empresa_id: meta.empresa_id ?? null,
    area_id: meta.area_id ?? null,
    cargo_id: meta.cargo_id ?? null,
    rol: 'colaborador',
    estado: 'pendiente_validacion',
  })

  // 23505 = clave duplicada: el perfil ya existía y no hay nada que hacer.
  if (error && error.code !== '23505') throw error
  return !error
}

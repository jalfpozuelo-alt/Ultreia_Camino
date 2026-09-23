# Ultreia Camino Web V10

V10 de la aplicación web móvil/PWA con Control de Gastos y Seguimiento de Grupo real con Supabase.

Cambios principales:
- Pantalla de grupo sin scroll general; el scroll queda confinado al listado de compañeros.
- Eliminado el bloque superior de nombre/estado personal para ganar espacio.
- Aviso explícito de privacidad: sin compartir ubicación, el usuario no comparte su posición y tampoco ve las posiciones de los demás.
- El permiso de ubicación se solicita primero con una posición puntual; si se deniega, el estado de compartir no queda activado.
- Los marcadores y nombres usan un color de identificación único dentro del grupo y consistente entre lista y mapa.
- Deducción de miembros por user_id para evitar duplicados visuales.
- Capas OSM automáticas para GR, Caminos de Santiago y Vías Verdes mediante Overpass, sin selector de capas.
- Preparación para pertenecer a varios grupos y selección del grupo activo.
- Sesión Supabase persistente explícita para evitar crear nuevas identidades anónimas por reintentos.
- Versión visible únicamente en la portada: V10.

Nota sobre grupos múltiples: la interfaz web V10 admite el concepto de grupo activo y consulta las membresías existentes, pero el backend actual conocido expone RPCs diseñadas originalmente alrededor de un único grupo activo (`join_group` y `leave_current_group`). Para garantizar completamente la pertenencia simultánea a varios grupos, esas funciones/RLS deben adaptarse en Supabase con una migración específica. No se inventa ni se modifica el contrato backend sin esa migración.

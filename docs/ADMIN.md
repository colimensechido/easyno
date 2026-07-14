# Administracion de plataforma

## Estado anterior

Antes de esta fase no existia una estructura de roles persistida. El modulo
administrativo de EyCon aparecia en frontend cuando el usuario era el creador
del mundo activo:

- Frontend: `isAdmin={Number(world.createdBy) === Number(session.user.id)}`.
- Backend: `requirePlatformAdmin()` buscaba el primer registro de `worlds` y
  comparaba `created_by` contra el usuario autenticado.

Eso significa que el acceso no se asignaba por rol, token firmado ni tabla de
permisos. Tampoco se validaba como rol en base de datos; era una regla fija
derivada del creador del primer mundo.

## Modelo nuevo de roles

Se agrego una base minima y extensible:

- `roles`: catalogo de roles. Inicialmente `user` y `admin`.
- `user_roles`: asignacion de roles por usuario.
- Los tokens JWT siguen cargando `id` y `username`, pero cada request valida el
  usuario activo y sus roles contra la base de datos.
- Las rutas `/api/admin/*` verifican el rol `admin` en servidor. Ocultar botones
  en frontend no es la defensa principal.

Bootstrap de administradores:

- `ADMIN_USER_IDS=1,2` y `ADMIN_USERNAMES=admin,owner` asignan admin al iniciar.
- Si el nombre de usuario normalizado es `colimense`, se le otorga `admin`
  siempre, incluso si no existe un rol persistido ni una asignacion manual.
- Si no existe ningun admin y ya habia un mundo, se migra una sola vez al
  usuario `created_by` del primer mundo como compatibilidad con la regla previa.
- Si se crea el primer mundo y aun no existe ningun admin, su creador recibe
  `admin` como bootstrap documentado, no como regla permanente de autorizacion.

## Tablas agregadas

- `admin_logs`: acciones administrativas auditadas.
- `currency_movements`: historial comun de ajustes manuales de monedas.
- `login_logs`: intentos de login exitosos y fallidos.
- `site_visits`: actividad basica autenticada por API.
- `chat_messages`: persistencia del chat global por mundo.
- `user_social_settings`, `user_relations` y `direct_messages`: preferencias,
  moderacion personal y conversaciones privadas.
- `user_reports`: bugs y sugerencias con contexto tecnico y captura opcional.
- `model_3d_settings`: ajustes editables y auditables de modelos GLB ligados a
  productos EyCon.
- `model_3d_assets`: lista blanca de assets GLB disponibles. Incluye modelos
  built-in y archivos subidos desde admin.

Tambien se agregaron columnas a `users`:

- `active`
- `created_at`
- `updated_at`
- `last_login_at`

Las contrasenas siguen usando `bcryptjs` con `bcrypt.hash(password, 10)`.

## Endpoints administrativos

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:userId`
- `POST /api/admin/users/:userId/password`
- `PUT /api/admin/users/:userId/roles`
- `GET /api/admin/currencies`
- `POST /api/admin/currencies/adjust`
- `GET /api/admin/logs`
- `GET /api/admin/stats`
- `GET /api/admin/chat`
- `GET /api/admin/reports`
- `GET /api/admin/reports/:reportId/screenshot`
- `PATCH /api/admin/reports/:reportId`
- `GET /api/admin/store-analysis`
- `GET /api/admin/model-3d-settings`
- `POST /api/admin/model-3d-assets`
- `PUT /api/admin/model-3d-settings/:productId`
- `DELETE /api/admin/model-3d-settings/:productId`

Rutas EyCon existentes siguen disponibles con rol admin:

- `GET /api/admin/eycon`
- `POST /api/admin/eycon/adjust`
- `POST /api/admin/eycon/products`
- `PUT /api/admin/eycon/products/:productId`
- `POST /api/admin/eycon/grant-product`

## Monedas

El panel `/admin` permite ajustar:

- Moneda normal por usuario y mundo (`economies.balance`).
- EyCon global por usuario (`eycon_accounts.balance_units`).

Cada ajuste exige motivo y registra:

- Usuario afectado.
- Moneda.
- Saldo anterior.
- Saldo nuevo.
- Diferencia.
- Motivo.
- Admin responsable.
- Fecha.

Para EyCon se reutiliza el ledger existente de `eycon_movements` y ademas se
crea una entrada en `currency_movements` para la vista administrativa global.

## Usuarios

El panel permite:

- Listar y buscar usuarios por ID o username.
- Cambiar username.
- Activar o desactivar usuarios.
- Cambiar contrasena con el mismo hash seguro existente.
- Cambiar roles.

Protecciones:

- No se puede quitar o desactivar al ultimo administrador.
- No se puede quitarse el rol admin a si mismo desde la sesion actual.
- Todo cambio sensible requiere motivo y escribe en `admin_logs`.

## Estadisticas

La primera fase registra informacion operacional basica:

- Usuarios conectados por socket.
- Usuarios activos recientemente por `last_login_at`.
- Visitas autenticadas de API.
- Visitas por dia.
- IP y user-agent de login/visita.
- Intentos fallidos de login.

No se guardan tokens ni contrasenas. La IP se guarda como dato operativo para
auditoria y debe tratarse como dato sensible.

## Chat

Antes el chat era efimero: solo se emitia por Socket.IO. Ahora cada mensaje se
guarda en `chat_messages` y `/admin` puede consultar:

- Mundo.
- Usuario.
- Texto.
- Fecha.
- Filtros por usuario, mundo, fecha y busqueda textual.

Cada usuario puede silenciar el sonido global del chat, mutear a una persona,
ignorar su chat publico o bloquearla. Bloquear tambien impide mensajes directos
en ambos sentidos; estas reglas se validan en servidor y se guardan en SQLite.

## Bugs y sugerencias

El icono de bicho abre un formulario que intenta capturar la vista visible y
adjunta ruta, sala, viewport, navegador, estado de conexion y errores recientes.
Las capturas se guardan en `uploads/reports` y solo se entregan mediante una ruta
autenticada con rol admin. En `/admin`, la pestana Reportes permite revisar la
captura, cambiar estado y guardar notas internas auditadas.

## Tienda y modelos 3D

Estado actual:

- Los productos EyCon viven en `eycon_products` con `metadata_json`.
- Los ajustes editables de piezas GLB viven en `model_3d_settings`, ligada por
  `product_id` a `eycon_products`.
- La tabla guarda `asset_key`, `file_path`, `fallback_model`, `fit_size`,
  `rotation_json`, `offset_json`, `color_locked`, `tintable`,
  `tint_strength`, `color_mode`, `preview_status` y `active`.
- Los assets permitidos viven en `model_3d_assets`; los uploads se guardan en
  `backend/uploads/models3d` y se sirven desde `/uploads/models3d/...`.
- Las piezas GLB siguen importandose en el bundle frontend desde
  `frontend/src/components/monopoly3d/CosmeticToken3D.js`, pero el asset que se
  puede elegir desde admin sale de una lista blanca del backend.
- Escala, offset y rotacion se leen desde `model_3d_settings` cuando el ajuste
  esta activo; si no, se usa el fallback primitivo.
- Los modelos GLB pueden usar `ORIGINAL` para conservar materiales, o
  `TINT`/`FORCE` para tomar el color activo del jugador.
- Al guardar un ajuste 3D sobre una pieza Monopoly, el producto queda como
  `LEGENDARY`.

CRUD 3D implementado:

- `GET /api/admin/model-3d-settings`: lista piezas Monopoly, settings,
  fallback models, preview statuses, color modes y assets permitidos.
- `POST /api/admin/model-3d-assets`: carga un `.glb` base64, valida cabecera
  GLB, lo guarda en backend y lo registra como asset aprobado.
- `PUT /api/admin/model-3d-settings/:productId`: crea o actualiza el ajuste 3D
  con motivo obligatorio y auditoria `MODEL_3D_UPSERT`.
- `DELETE /api/admin/model-3d-settings/:productId`: desactiva el ajuste 3D con
  motivo obligatorio y auditoria `MODEL_3D_DELETE`.
- `/admin` incluye carga de GLB, selector de producto, asset aprobado, escala,
  rotacion, offset, modo de color, estado de preview y visor 3D.

Para probar colores:

- `Original`: conserva materiales y texturas del GLB.
- `Tinte`: mezcla el color de prueba con el material segun `tint_strength`.
- `Forzar`: aplica el color del jugador sobre el material con fuerza completa.

El selector de color del panel solo simula el color activo del jugador. No se
guarda ningun color de tinte por modelo; lo persistente es el modo de color y
los ajustes 3D guardados.

Flujo localhost -> produccion:

- En localhost, levanta backend con `MODEL_3D_WRITE_SEED=1` o
  `EYCON_STORE_WRITE_SEED=1` y guarda desde `/admin`; esto actualiza
  `backend/model-3d-seed.json`.
- Tambien puedes exportar el estado actual de la tienda local con
  `npm run export:eycon-seed`.
- Ese seed versionable incluye productos EyCon, assets GLB aprobados y ajustes
  3D. Si localhost muestra 85 productos activos, produccion debe llegar a 85
  tras desplegar el seed.
- Si subes GLB nuevos, versiona tambien `backend/uploads/models3d/*.glb`.
- En Docker, el backend lee `model-3d-seed.json` al arrancar y copia los GLB
  versionados hacia `/app/uploads/models3d`, que queda persistido por volumen.

## Pendiente recomendado

- Paginacion en tablas admin cuando crezca la base.
- Sesiones persistentes por dispositivo.
- Moderacion administrativa destructiva: ocultar/restaurar mensajes con motivo.
- Politica de almacenamiento/CDN para GLB si el volumen crece.
- Export CSV de logs y movimientos.
- Politica de retencion para IP, visitas y login logs.

# EyCon

EyCon es una moneda global de plataforma independiente del dinero normal de cada mundo.

## Unidad monetaria

El backend guarda enteros:

- `100 balance_units = 1 EyCon`
- `1 balance_unit = 0.01 EyCon`

Esto evita errores de precisión de punto flotante.

## Tablas

- `eycon_accounts`: saldo global por usuario.
- `eycon_movements`: libro mayor inmutable con saldo anterior/nuevo e idempotencia.
- `eycon_products`: catálogo por juego, categoría, slot y rareza.
- `eycon_inventory`: productos que posee cada usuario.
- `eycon_equipment`: producto activo por usuario, juego y slot.
- `eycon_wagers`: reserva y resolución persistente de apuestas EyCon.

La migración declarativa está en `backend/migrations/002-eycon.sql`. El servidor también crea las tablas automáticamente al arrancar y siembra el catálogo inicial desde `backend/eycon-catalog.js`.

## Recompensas

### Blackjack contra dealer IA

- Solo una recompensa por usuario y ronda.
- Fórmula: `1 + floor(apuesta_normal / 100)` unidades.
- Mínimo: `0.01 EyCon`.
- Máximo: `0.05 EyCon` por victoria.
- Límite diario: `1.00 EyCon` por usuario.
- Una apuesta realizada directamente con EyCon no genera EyCon adicional.

### Monopoly

Solo se entrega cuando:

- El estado es `FINALIZADO`.
- Existe un ganador.
- La partida supera 150 turnos.
- La mesa no fue invalidada por rendición/abandono.

Escala:

- 151–199 turnos: `1.00 EyCon`.
- 200–249 turnos: `1.25 EyCon`.
- 250–299 turnos: `1.50 EyCon`.
- Continúa en incrementos de `0.25`, con máximo de `2.00 EyCon`.

La clave `monopoly:<tableId>:winner:<userId>` impide pagos duplicados.

## Apuestas EyCon

El Blackjack individual HTTP acepta `currency: "EYCON"` y una apuesta expresada en unidades:

- `1` = `0.01 EyCon`.
- Mínimo `0.01`.
- Máximo `1.00`.
- La apuesta se registra como `WAGER_STAKE`.
- Ganancia como `WAGER_PAYOUT`.
- Empate como `WAGER_REFUND`.

Cada fase utiliza una clave idempotente derivada de la sesión.
Si el servidor reinicia con una apuesta individual abierta, el arranque la marca como reembolsada y devuelve automáticamente la reserva.

## API de usuario

- `GET /api/eycon/health`
- `GET /api/eycon/profile`
- `GET /api/eycon/games`
- `GET /api/eycon/catalog?gameKey=MONOPOLY`
- `GET /api/eycon/history`
- `POST /api/eycon/purchase`
- `POST /api/eycon/equip`
- `POST /api/eycon/unequip`

El evento Socket.IO `eycon_update` mantiene visible el saldo más reciente.

La tienda comienza con un selector de minijuego. `MONOPOLY`, `BLACKJACK`,
`DISHES` y `SURVIVAL` forman parte del registro global; un juego se habilita
para entrar cuando tiene al menos un producto activo. Por ahora el catálogo
publicado es el de Monopoly. Esto evita vender cosméticos de otros juegos
antes de que exista su integración visual.

El script de desarrollo usa `node --watch server.js` para recargar cambios del
backend. El proceso que estaba abierto antes de este ajuste todavía debe
reiniciarse una vez. Si una ruta nueva responde `Cannot GET /api/eycon/...`,
el servidor activo sigue ejecutando una versión anterior.

## Administración

El acceso administrativo ahora usa roles persistidos (`roles` y `user_roles`).
Además, si el nombre de usuario normalizado es `colimense`, el backend lo trata
como `admin` siempre, incluso sin un rol persistido. El creador del primer mundo
solo se migra como `admin` cuando no existe ningún administrador previo, para
conservar compatibilidad con instalaciones antiguas. La documentación completa
del panel está en `docs/ADMIN.md`.

- `GET /api/admin/eycon`
- `POST /api/admin/eycon/adjust`
- `POST /api/admin/eycon/products`
- `PUT /api/admin/eycon/products/:productId`
- `POST /api/admin/eycon/grant-product`

El panel inicial de la tienda muestra saldos y movimientos y permite ajustes auditados. Los endpoints permiten además crear/editar/desactivar productos y asignarlos.

## Catálogo Monopoly

El catálogo inicial contiene:

- 17 piezas 3D seleccionadas: 10 procedurales recoloreables y 7 modelos
  GLB legendarios configurables desde Admin.
- 15 diseños de dados.
- 10 FX de dados con comportamientos diferenciados.
- 6 temas de tablero.

Los productos usan metadata JSON y las piezas GLB editables se complementan
con `model_3d_settings`. Las piezas se construyen con geometría 3D, o con
modelos GLB registrados en el frontend y elegidos desde la lista blanca del
admin. Esa lista vive en `model_3d_assets` y puede incluir archivos subidos a
`/uploads/models3d`. Los modelos GLB de piezas pueden conservar color original,
recibir tinte o forzar el color activo del jugador, y se publican como
legendarios. El tinte no guarda un color propio por modelo.
Los dados cambian materiales, los FX combinan partículas, anillos, luz y
descargas, y los tableros aplican paletas y acabados materiales. Esta
estructura permite ajustar modelos GLB sin cambiar inventario, compras ni
equipamiento.

La tienda incluye un probador 3D interactivo. Los diseños de dados y FX
reutilizan el renderer de Monopoly; las piezas usan el mismo modelo geométrico
o GLB en la tienda y durante la partida. Los temas equipados cambian base,
centro, aro, color y acabado material del tablero 3D, además de la paleta del
tablero 2D. La compra pasa por una confirmación que presenta saldo actual,
precio y saldo resultante antes de registrar el movimiento.

### Autoridad de cosméticos en Monopoly

- Los dados y el FX visibles pertenecen siempre al jugador cuyo turno está
  activo.
- Cada jugador conserva su propia pieza y su propio color.
- El color de una pieza no viene fijado por el producto: usa el color activo
  elegido por el jugador.
- El mismo color puede cambiarse desde Monopoly o desde el probador de la
  tienda; el backend evita colores duplicados dentro de una mesa activa.
- El selector de ficha dentro de Monopoly muestra la figura clásica y las
  piezas del inventario completo del usuario, sin exigir que ya estén
  equipadas, con una vista previa 3D del color elegido.
- El tema del tablero visible para todos se toma exclusivamente del
  equipamiento del anfitrión de la mesa.
- El anfitrión dispone de un selector de tablero dentro de la sala de espera y
  durante la partida. Puede elegir el tema clásico o cualquiera de sus diseños
  comprados; los demás jugadores no ven ese control.
- Cambiar equipamiento o color vuelve a emitir el estado de las mesas activas
  para actualizar a los demás jugadores.

## Controles antiabuso

- Saldo con restricción `CHECK(balance_units >= 0)`.
- Operaciones de saldo serializadas y transaccionales.
- Claves de idempotencia únicas.
- Catálogo, propiedad y compatibilidad validados en backend.
- No se puede comprar dos veces el mismo producto.
- No se puede equipar algo no poseído o desactivado.
- Recompensas de Blackjack con límite diario.
- Monopoly invalida la recompensa al rendirse.
- Todos los ingresos/egresos monetarios quedan auditados.

# Monopoly Engine

Motor logico puro de Monopoly clasico, desacoplado de interfaz y listo para conectarse a una UI, API HTTP o servidor en tiempo real.

## Entrada principal

```js
import { MonopolyGameEngine, GAME_MODES } from "./shared/monopoly-engine/index.mjs";

const game = new MonopolyGameEngine({
  players: ["Ana", "Luis", "Marta"],
  mode: GAME_MODES.NORMAL
});

game.iniciarPartida();
```

## API principal

- `iniciarPartida()`
- `ejecutarAccion(actionName, payload)`
- `listarAccionesDisponibles({ playerId })`
- `tirarDados({ dados })`
- `comprarPropiedad()`
- `rechazarCompra()`
- `iniciarSubasta({ tipo, objetivoId, cantidad, participantes, meta })`
- `hacerOferta({ jugadorId, monto })`
- `retirarseDeSubasta({ jugadorId })`
- `resolverCarta()`
- `pagarRenta()`
- `pagarImpuesto({ opcion })`
- `comprarCasa(propertyId)`
- `comprarHotel(propertyId)`
- `venderCasa(propertyId)`
- `venderHotel(propertyId)`
- `hipotecarPropiedad(propertyId)`
- `levantarHipoteca(propertyId)`
- `venderPropiedad({ vendedorId, compradorId, propiedadId, precio, levantarHipotecaAhora })`
- `comprarCartaSalirCarcel({ vendedorId, compradorId, deck, precio })`
- `usarCartaSalirCarcel()`
- `pagarMultaCarcel()`
- `resolverDeudaPendiente()`
- `resolverQuiebra()`
- `terminarTurno()`
- `consultarGanador()`
- `calcularRiquezaJugador(playerId)`
- `rankearJugadores()`
- `getState()`

## Selectores listos para UI/API

- `buildPlayerSnapshot(game, playerId)`
- `buildTurnSnapshot(game)`
- `buildGameSnapshot(game)`

## Notas de modelo

- El estado es serializable y no depende del DOM.
- El tablero es clasico de 40 casillas.
- El banco no quiebra.
- El modo corto y el modo con limite de tiempo estan soportados.
- Las subastas de propiedades funcionan de forma completa.
- El motor expone subasta generica para edificios, pensada para que la UI coordine escasez de casas u hoteles con `meta`.

## Pruebas

```bash
npm run test:monopoly
```

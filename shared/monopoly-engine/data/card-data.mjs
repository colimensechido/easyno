import { CARD_DECKS, CARD_EFFECTS } from "../constants.mjs";

function card({ id, deck, title, text = "", effect, amount = 0, target = null, steps = 0, keepable = false, meta = {} }) {
  return {
    id,
    deck,
    title,
    text,
    effect,
    amount,
    target,
    steps,
    keepable,
    meta
  };
}

export function createChanceDeck() {
  return [
    card({ id: "chance_advance_go", deck: CARD_DECKS.CHANCE, title: "Turbo hasta Salida", text: "Pisa acelerador, cobra como protagonista y saluda al banco.", effect: CARD_EFFECTS.MOVE_TO, target: "go" }),
    card({ id: "chance_advance_illinois", deck: CARD_DECKS.CHANCE, title: "Fast travel a Buenos Aires", text: "La ruta VIP se abrio. Que el mapa cargue rapido.", effect: CARD_EFFECTS.MOVE_TO, target: "illinois_avenue" }),
    card({ id: "chance_advance_st_charles", deck: CARD_DECKS.CHANCE, title: "Mision express: Arequipa", text: "Nueva ubicacion desbloqueada. Cuidado con rentas sorpresa.", effect: CARD_EFFECTS.MOVE_TO, target: "st_charles_place" }),
    card({ id: "chance_nearest_utility", deck: CARD_DECKS.CHANCE, title: "Servicio cercano: modo boss", text: "Busca la infraestructura mas cercana. La factura viene con multiplicador.", effect: CARD_EFFECTS.MOVE_TO_NEAREST_UTILITY, meta: { utilityMultiplier: 10 } }),
    card({ id: "chance_nearest_railroad_1", deck: CARD_DECKS.CHANCE, title: "Tren mas cercano x2", text: "El conductor trae prisa y el cobrador trae sonrisa peligrosa.", effect: CARD_EFFECTS.MOVE_TO_NEAREST_RAILROAD, meta: { rentMultiplier: 2 } }),
    card({ id: "chance_nearest_railroad_2", deck: CARD_DECKS.CHANCE, title: "Otro tren, doble drama", text: "Sube al vagon del plot twist. Si hay dueno, paga renta potenciada.", effect: CARD_EFFECTS.MOVE_TO_NEAREST_RAILROAD, meta: { rentMultiplier: 2 } }),
    card({ id: "chance_bank_dividend", deck: CARD_DECKS.CHANCE, title: "Dividendos inesperados", text: "El banco se equivoco a tu favor y hoy no haremos preguntas.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 50 }),
    card({ id: "chance_get_out_jail", deck: CARD_DECKS.CHANCE, title: "Llave ninja de carcel", text: "Guardala en el inventario. Un dia sera tu escape cinematografico.", effect: CARD_EFFECTS.GET_OUT_OF_JAIL, keepable: true }),
    card({ id: "chance_go_back_three", deck: CARD_DECKS.CHANCE, title: "Rollback de tres casillas", text: "El tablero dijo Ctrl+Z. Retrocede y finge que era estrategia.", effect: CARD_EFFECTS.MOVE_BACK, steps: 3 }),
    card({ id: "chance_go_to_jail", deck: CARD_DECKS.CHANCE, title: "Patrulla activada", text: "Sin dados, sin excusas: directo a la carcel a repensar builds.", effect: CARD_EFFECTS.GO_TO_JAIL }),
    card({ id: "chance_general_repairs", deck: CARD_DECKS.CHANCE, title: "Parche de edificios", text: "Tus propiedades necesitan mantenimiento. El changelog no salio gratis.", effect: CARD_EFFECTS.REPAIRS, meta: { perHouse: 25, perHotel: 100 } }),
    card({ id: "chance_poor_tax", deck: CARD_DECKS.CHANCE, title: "Impuesto anti suerte", text: "Cargo pequeno, orgullo grande. El banco tambien cobra memes.", effect: CARD_EFFECTS.PAY_BANK, amount: 15 }),
    card({ id: "chance_reading_railroad", deck: CARD_DECKS.CHANCE, title: "Ruta directa al Tren Maya", text: "Viaje desbloqueado. Si alguien es dueno, lleva monedas listas.", effect: CARD_EFFECTS.MOVE_TO, target: "reading_railroad" }),
    card({ id: "chance_boardwalk", deck: CARD_DECKS.CHANCE, title: "Portal a Ciudad de Mexico", text: "La casilla premium te llama. Puede ser gloria o recibo caro.", effect: CARD_EFFECTS.MOVE_TO, target: "boardwalk" }),
    card({ id: "chance_chairman", deck: CARD_DECKS.CHANCE, title: "Presidente del consejo", text: "Ganaste el cargo, perdiste liquidez: paga a cada jugador.", effect: CARD_EFFECTS.PAY_EACH_PLAYER, amount: 50 }),
    card({ id: "chance_building_loan", deck: CARD_DECKS.CHANCE, title: "Prestamo de construccion cobrado", text: "El banco recordo que te debe. Milagro financiero desbloqueado.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 150 })
  ];
}

export function createCommunityChestDeck() {
  return [
    card({ id: "chest_advance_go", deck: CARD_DECKS.COMMUNITY_CHEST, title: "La comunidad te empuja a Salida", text: "Vuelta completa patrocinada por vecinos sospechosamente amables.", effect: CARD_EFFECTS.MOVE_TO, target: "go" }),
    card({ id: "chest_bank_error", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Bug del banco a tu favor", text: "Deposito fantasma confirmado. No reportes el glitch.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 200 }),
    card({ id: "chest_doctors_fee", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Consulta medica premium", text: "El diagnostico: billetera inflamada. Tratamiento: pagar.", effect: CARD_EFFECTS.PAY_BANK, amount: 50 }),
    card({ id: "chest_sale_of_stock", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Acciones vendidas en verde", text: "Timing perfecto. Los traders del chat aplauden de pie.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 50 }),
    card({ id: "chest_get_out_jail", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Pase vecinal anti carcel", text: "La comunidad firmo por ti. Guardalo para una fuga elegante.", effect: CARD_EFFECTS.GET_OUT_OF_JAIL, keepable: true }),
    card({ id: "chest_go_to_jail", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Vecinos llamaron patrulla", text: "La junta fue clara: directo a carcel, sin pasar por lore.", effect: CARD_EFFECTS.GO_TO_JAIL }),
    card({ id: "chest_holiday_fund", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Fondo navideno liberado", text: "Aparecio el sobre perdido. Santa tambien diversifica.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 }),
    card({ id: "chest_income_tax_refund", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Reembolso fiscal mini", text: "No compra un imperio, pero alegra el HUD.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 20 }),
    card({ id: "chest_birthday", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Cumpleanos con loot", text: "Cada jugador te suelta regalo. La amistad monetizada.", effect: CARD_EFFECTS.RECEIVE_FROM_EACH_PLAYER, amount: 10 }),
    card({ id: "chest_life_insurance", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Seguro de vida cobrado", text: "Papeleo aprobado. La burocracia tuvo un momento heroico.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 }),
    card({ id: "chest_hospital_fees", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Factura de hospital", text: "Te curaron, pero el recibo viene con golpe critico.", effect: CARD_EFFECTS.PAY_BANK, amount: 100 }),
    card({ id: "chest_school_fees", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Colegiatura legendaria", text: "Educacion desbloqueada. Tu efectivo no sobrevivio igual.", effect: CARD_EFFECTS.PAY_BANK, amount: 150 }),
    card({ id: "chest_consultancy_fee", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Consultoria cobrada", text: "Dijiste tres buzzwords y alguien pago la factura.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 25 }),
    card({ id: "chest_street_repairs", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Calles en modo mantenimiento", text: "La comunidad exige arreglos. Tus edificios pasan por caja.", effect: CARD_EFFECTS.REPAIRS, meta: { perHouse: 40, perHotel: 115 } }),
    card({ id: "chest_beauty_contest", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Concurso ganado por carisma", text: "No preguntes como. Cobra y posa para la camara.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 10 }),
    card({ id: "chest_inheritance", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Herencia sorpresa", text: "Un pariente del lore dejo monedas. Respeta la cinematica.", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 })
  ];
}

import { CARD_DECKS, CARD_EFFECTS } from "../constants.mjs";

function card({ id, deck, title, effect, amount = 0, target = null, steps = 0, keepable = false, meta = {} }) {
  return {
    id,
    deck,
    title,
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
    card({ id: "chance_advance_go", deck: CARD_DECKS.CHANCE, title: "Avanza hasta Salida", effect: CARD_EFFECTS.MOVE_TO, target: "go" }),
    card({ id: "chance_advance_illinois", deck: CARD_DECKS.CHANCE, title: "Avanza hasta Avenida Illinois", effect: CARD_EFFECTS.MOVE_TO, target: "illinois_avenue" }),
    card({ id: "chance_advance_st_charles", deck: CARD_DECKS.CHANCE, title: "Avanza hasta Plaza St. Charles", effect: CARD_EFFECTS.MOVE_TO, target: "st_charles_place" }),
    card({ id: "chance_nearest_utility", deck: CARD_DECKS.CHANCE, title: "Avanza al servicio mas cercano", effect: CARD_EFFECTS.MOVE_TO_NEAREST_UTILITY, meta: { utilityMultiplier: 10 } }),
    card({ id: "chance_nearest_railroad_1", deck: CARD_DECKS.CHANCE, title: "Avanza al ferrocarril mas cercano", effect: CARD_EFFECTS.MOVE_TO_NEAREST_RAILROAD, meta: { rentMultiplier: 2 } }),
    card({ id: "chance_nearest_railroad_2", deck: CARD_DECKS.CHANCE, title: "Avanza al ferrocarril mas cercano", effect: CARD_EFFECTS.MOVE_TO_NEAREST_RAILROAD, meta: { rentMultiplier: 2 } }),
    card({ id: "chance_bank_dividend", deck: CARD_DECKS.CHANCE, title: "El banco paga dividendos", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 50 }),
    card({ id: "chance_get_out_jail", deck: CARD_DECKS.CHANCE, title: "Salir libre de la carcel", effect: CARD_EFFECTS.GET_OUT_OF_JAIL, keepable: true }),
    card({ id: "chance_go_back_three", deck: CARD_DECKS.CHANCE, title: "Retrocede tres espacios", effect: CARD_EFFECTS.MOVE_BACK, steps: 3 }),
    card({ id: "chance_go_to_jail", deck: CARD_DECKS.CHANCE, title: "Vayase a la carcel", effect: CARD_EFFECTS.GO_TO_JAIL }),
    card({ id: "chance_general_repairs", deck: CARD_DECKS.CHANCE, title: "Haz reparaciones generales", effect: CARD_EFFECTS.REPAIRS, meta: { perHouse: 25, perHotel: 100 } }),
    card({ id: "chance_poor_tax", deck: CARD_DECKS.CHANCE, title: "Paga impuesto por pobre", effect: CARD_EFFECTS.PAY_BANK, amount: 15 }),
    card({ id: "chance_reading_railroad", deck: CARD_DECKS.CHANCE, title: "Lleva tu ficha a Ferrocarril Reading", effect: CARD_EFFECTS.MOVE_TO, target: "reading_railroad" }),
    card({ id: "chance_boardwalk", deck: CARD_DECKS.CHANCE, title: "Lleva tu ficha a Paseo Boardwalk", effect: CARD_EFFECTS.MOVE_TO, target: "boardwalk" }),
    card({ id: "chance_chairman", deck: CARD_DECKS.CHANCE, title: "Elegido presidente del consejo", effect: CARD_EFFECTS.PAY_EACH_PLAYER, amount: 50 }),
    card({ id: "chance_building_loan", deck: CARD_DECKS.CHANCE, title: "Tu prestamo para edificios vence", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 150 })
  ];
}

export function createCommunityChestDeck() {
  return [
    card({ id: "chest_advance_go", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Avanza hasta Salida", effect: CARD_EFFECTS.MOVE_TO, target: "go" }),
    card({ id: "chest_bank_error", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Error del banco a tu favor", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 200 }),
    card({ id: "chest_doctors_fee", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Paga honorarios medicos", effect: CARD_EFFECTS.PAY_BANK, amount: 50 }),
    card({ id: "chest_sale_of_stock", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Venta de acciones", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 50 }),
    card({ id: "chest_get_out_jail", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Salir libre de la carcel", effect: CARD_EFFECTS.GET_OUT_OF_JAIL, keepable: true }),
    card({ id: "chest_go_to_jail", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Vayase a la carcel", effect: CARD_EFFECTS.GO_TO_JAIL }),
    card({ id: "chest_holiday_fund", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Recibe por fondo de navidad", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 }),
    card({ id: "chest_income_tax_refund", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Devolucion de impuesto", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 20 }),
    card({ id: "chest_birthday", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Es tu cumpleanos", effect: CARD_EFFECTS.RECEIVE_FROM_EACH_PLAYER, amount: 10 }),
    card({ id: "chest_life_insurance", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Cobra seguro de vida", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 }),
    card({ id: "chest_hospital_fees", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Paga hospital", effect: CARD_EFFECTS.PAY_BANK, amount: 100 }),
    card({ id: "chest_school_fees", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Paga colegio", effect: CARD_EFFECTS.PAY_BANK, amount: 150 }),
    card({ id: "chest_consultancy_fee", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Honorarios de consultoria", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 25 }),
    card({ id: "chest_street_repairs", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Haz reparaciones de calle", effect: CARD_EFFECTS.REPAIRS, meta: { perHouse: 40, perHotel: 115 } }),
    card({ id: "chest_beauty_contest", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Ganaste un concurso", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 10 }),
    card({ id: "chest_inheritance", deck: CARD_DECKS.COMMUNITY_CHEST, title: "Recibes una herencia", effect: CARD_EFFECTS.RECEIVE_MONEY, amount: 100 })
  ];
}

import {
  DEFAULT_INCOME_TAX,
  DEFAULT_INCOME_TAX_RATE,
  LUXURY_TAX,
  PROPERTY_KINDS,
  SPACE_TYPES
} from "../constants.mjs";

function streetSpace({
  index,
  id,
  name,
  shortName,
  colorGroup,
  price,
  mortgageValue,
  houseCost,
  rents
}) {
  return {
    index,
    id,
    name,
    shortName,
    type: SPACE_TYPES.PROPERTY,
    propertyKind: PROPERTY_KINDS.STREET,
    colorGroup,
    price,
    mortgageValue,
    houseCost,
    hotelCost: houseCost,
    rents,
    ownerId: null,
    houses: 0,
    hasHotel: false,
    isMortgaged: false
  };
}

function railroadSpace({ index, id, name }) {
  return {
    index,
    id,
    name,
    type: SPACE_TYPES.RAILROAD,
    propertyKind: PROPERTY_KINDS.RAILROAD,
    price: 200,
    mortgageValue: 100,
    rentSchedule: [25, 50, 100, 200],
    ownerId: null,
    isMortgaged: false
  };
}

function utilitySpace({ index, id, name }) {
  return {
    index,
    id,
    name,
    type: SPACE_TYPES.UTILITY,
    propertyKind: PROPERTY_KINDS.UTILITY,
    price: 150,
    mortgageValue: 75,
    ownerId: null,
    isMortgaged: false
  };
}

export function createClassicBoard() {
  return [
    { index: 0, id: "go", name: "Salida", type: SPACE_TYPES.GO },
    streetSpace({
      index: 1,
      id: "mediterranean_avenue",
      name: "La Paz",
      shortName: "LPZ",
      colorGroup: "brown",
      price: 60,
      mortgageValue: 30,
      houseCost: 50,
      rents: [2, 10, 30, 90, 160, 250]
    }),
    { index: 2, id: "community_chest_1", name: "Arca Comunal", type: SPACE_TYPES.COMMUNITY_CHEST },
    streetSpace({
      index: 3,
      id: "baltic_avenue",
      name: "Sucre",
      shortName: "Sucre",
      colorGroup: "brown",
      price: 60,
      mortgageValue: 30,
      houseCost: 50,
      rents: [4, 20, 60, 180, 320, 450]
    }),
    {
      index: 4,
      id: "income_tax",
      name: "Impuesto sobre ingresos",
      type: SPACE_TYPES.TAX,
      taxKind: "OPTIONAL_PERCENT",
      fixedAmount: DEFAULT_INCOME_TAX,
      percentRate: DEFAULT_INCOME_TAX_RATE
    },
    railroadSpace({ index: 5, id: "reading_railroad", name: "Tren Maya" }),
    streetSpace({
      index: 6,
      id: "oriental_avenue",
      name: "Quito",
      shortName: "Quito",
      colorGroup: "light_blue",
      price: 100,
      mortgageValue: 50,
      houseCost: 50,
      rents: [6, 30, 90, 270, 400, 550]
    }),
    { index: 7, id: "chance_1", name: "Casualidad", type: SPACE_TYPES.CHANCE },
    streetSpace({
      index: 8,
      id: "vermont_avenue",
      name: "Cuenca",
      shortName: "Cuenca",
      colorGroup: "light_blue",
      price: 100,
      mortgageValue: 50,
      houseCost: 50,
      rents: [6, 30, 90, 270, 400, 550]
    }),
    streetSpace({
      index: 9,
      id: "connecticut_avenue",
      name: "Guayaquil",
      shortName: "GYE",
      colorGroup: "light_blue",
      price: 120,
      mortgageValue: 60,
      houseCost: 50,
      rents: [8, 40, 100, 300, 450, 600]
    }),
    { index: 10, id: "jail", name: "Carcel / Visita", type: SPACE_TYPES.JAIL },
    streetSpace({
      index: 11,
      id: "st_charles_place",
      name: "Arequipa",
      shortName: "AQP",
      colorGroup: "pink",
      price: 140,
      mortgageValue: 70,
      houseCost: 100,
      rents: [10, 50, 150, 450, 625, 750]
    }),
    utilitySpace({ index: 12, id: "electric_company", name: "Red Eléctrica Andina" }),
    streetSpace({
      index: 13,
      id: "states_avenue",
      name: "Cusco",
      shortName: "Cusco",
      colorGroup: "pink",
      price: 140,
      mortgageValue: 70,
      houseCost: 100,
      rents: [10, 50, 150, 450, 625, 750]
    }),
    streetSpace({
      index: 14,
      id: "virginia_avenue",
      name: "Lima",
      shortName: "Lima",
      colorGroup: "pink",
      price: 160,
      mortgageValue: 80,
      houseCost: 100,
      rents: [12, 60, 180, 500, 700, 900]
    }),
    railroadSpace({ index: 15, id: "pennsylvania_railroad", name: "Tren del Pacífico" }),
    streetSpace({
      index: 16,
      id: "st_james_place",
      name: "Valparaiso",
      shortName: "Valpo",
      colorGroup: "orange",
      price: 180,
      mortgageValue: 90,
      houseCost: 100,
      rents: [14, 70, 200, 550, 750, 950]
    }),
    { index: 17, id: "community_chest_2", name: "Arca Comunal", type: SPACE_TYPES.COMMUNITY_CHEST },
    streetSpace({
      index: 18,
      id: "tennessee_avenue",
      name: "Concepcion",
      shortName: "CCP",
      colorGroup: "orange",
      price: 180,
      mortgageValue: 90,
      houseCost: 100,
      rents: [14, 70, 200, 550, 750, 950]
    }),
    streetSpace({
      index: 19,
      id: "new_york_avenue",
      name: "Santiago",
      shortName: "STGO",
      colorGroup: "orange",
      price: 200,
      mortgageValue: 100,
      houseCost: 100,
      rents: [16, 80, 220, 600, 800, 1000]
    }),
    { index: 20, id: "free_parking", name: "Parada Libre", type: SPACE_TYPES.FREE_PARKING },
    streetSpace({
      index: 21,
      id: "kentucky_avenue",
      name: "Rosario",
      shortName: "ROS",
      colorGroup: "red",
      price: 220,
      mortgageValue: 110,
      houseCost: 150,
      rents: [18, 90, 250, 700, 875, 1050]
    }),
    { index: 22, id: "chance_2", name: "Casualidad", type: SPACE_TYPES.CHANCE },
    streetSpace({
      index: 23,
      id: "indiana_avenue",
      name: "Cordoba",
      shortName: "CBA",
      colorGroup: "red",
      price: 220,
      mortgageValue: 110,
      houseCost: 150,
      rents: [18, 90, 250, 700, 875, 1050]
    }),
    streetSpace({
      index: 24,
      id: "illinois_avenue",
      name: "Buenos Aires",
      shortName: "BSAS",
      colorGroup: "red",
      price: 240,
      mortgageValue: 120,
      houseCost: 150,
      rents: [20, 100, 300, 750, 925, 1100]
    }),
    railroadSpace({ index: 25, id: "bo_railroad", name: "Tren de la Pampa" }),
    streetSpace({
      index: 26,
      id: "atlantic_avenue",
      name: "Cali",
      shortName: "Cali",
      colorGroup: "yellow",
      price: 260,
      mortgageValue: 130,
      houseCost: 150,
      rents: [22, 110, 330, 800, 975, 1150]
    }),
    streetSpace({
      index: 27,
      id: "ventnor_avenue",
      name: "Medellin",
      shortName: "MDE",
      colorGroup: "yellow",
      price: 260,
      mortgageValue: 130,
      houseCost: 150,
      rents: [22, 110, 330, 800, 975, 1150]
    }),
    utilitySpace({ index: 28, id: "water_works", name: "Aguas del Caribe" }),
    streetSpace({
      index: 29,
      id: "marvin_gardens",
      name: "Bogota",
      shortName: "BOG",
      colorGroup: "yellow",
      price: 280,
      mortgageValue: 140,
      houseCost: 150,
      rents: [24, 120, 360, 850, 1025, 1200]
    }),
    { index: 30, id: "go_to_jail", name: "Vayase a la carcel", type: SPACE_TYPES.GO_TO_JAIL },
    streetSpace({
      index: 31,
      id: "pacific_avenue",
      name: "Brasilia",
      shortName: "BSB",
      colorGroup: "green",
      price: 300,
      mortgageValue: 150,
      houseCost: 200,
      rents: [26, 130, 390, 900, 1100, 1275]
    }),
    streetSpace({
      index: 32,
      id: "north_carolina_avenue",
      name: "Rio de Janeiro",
      shortName: "RIO",
      colorGroup: "green",
      price: 300,
      mortgageValue: 150,
      houseCost: 200,
      rents: [26, 130, 390, 900, 1100, 1275]
    }),
    { index: 33, id: "community_chest_3", name: "Arca Comunal", type: SPACE_TYPES.COMMUNITY_CHEST },
    streetSpace({
      index: 34,
      id: "pennsylvania_avenue",
      name: "Sao Paulo",
      shortName: "SP",
      colorGroup: "green",
      price: 320,
      mortgageValue: 160,
      houseCost: 200,
      rents: [28, 150, 450, 1000, 1200, 1400]
    }),
    railroadSpace({ index: 35, id: "short_line", name: "Tren Austral" }),
    { index: 36, id: "chance_3", name: "Casualidad", type: SPACE_TYPES.CHANCE },
    streetSpace({
      index: 37,
      id: "park_place",
      name: "Guadalajara",
      shortName: "GDL",
      colorGroup: "dark_blue",
      price: 350,
      mortgageValue: 175,
      houseCost: 200,
      rents: [35, 175, 500, 1100, 1300, 1500]
    }),
    {
      index: 38,
      id: "luxury_tax",
      name: "Impuesto de lujo",
      type: SPACE_TYPES.TAX,
      taxKind: "FIXED",
      fixedAmount: LUXURY_TAX
    },
    streetSpace({
      index: 39,
      id: "boardwalk",
      name: "Ciudad de Mexico",
      shortName: "CDMX",
      colorGroup: "dark_blue",
      price: 400,
      mortgageValue: 200,
      houseCost: 200,
      rents: [50, 200, 600, 1400, 1700, 2000]
    })
  ];
}

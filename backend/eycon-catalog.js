const rarityPrices = {
  COMMON: 35,
  RARE: 75,
  EPIC: 150,
  LEGENDARY: 300
};

const gameDefinitions = [
  {
    key: "MONOPOLY",
    name: "Monopoly",
    description: "Piezas, dados, efectos y tableros para personalizar cada partida.",
    icon: "🏛️",
    accent: "#22d3ee",
    categories: [
      { key: "TOKEN", label: "Piezas" },
      { key: "DICE", label: "Dados" },
      { key: "DICE_FX", label: "FX de dados" },
      { key: "BOARD_THEME", label: "Tableros" }
    ]
  },
  {
    key: "BLACKJACK",
    name: "Blackjack",
    description: "Diseños de mesa, cartas, fichas y efectos de reparto.",
    icon: "♠",
    accent: "#f59e0b",
    categories: [
      { key: "CARD_BACK", label: "Cartas" },
      { key: "TABLE_THEME", label: "Mesas" },
      { key: "CHIP_SET", label: "Fichas" },
      { key: "DEAL_FX", label: "FX de reparto" }
    ]
  },
  {
    key: "DISHES",
    name: "Trabajo",
    description: "Herramientas, estaciones y efectos visuales para el minijuego de platos.",
    icon: "🫧",
    accent: "#34d399",
    categories: [
      { key: "TOOL", label: "Herramientas" },
      { key: "STATION_THEME", label: "Estaciones" },
      { key: "WORKER_STYLE", label: "Estilos" },
      { key: "CLEAN_FX", label: "FX de limpieza" }
    ]
  },
  {
    key: "SURVIVAL",
    name: "Marronazo Survival",
    description: "Personajes, apariencias, rastros y efectos para el modo survival.",
    icon: "💥",
    accent: "#fb7185",
    categories: [
      { key: "CHARACTER", label: "Personajes" },
      { key: "WEAPON_SKIN", label: "Armas" },
      { key: "TRAIL", label: "Rastros" },
      { key: "ACTION_FX", label: "FX de acción" }
    ]
  }
];

const tokenDefinitions = [
  ["golden-hat", "Sombrero de magnate", "Sombrero de copa con cinta, hebilla y acabado de oro cepillado.", "RARE", "🎩", "#d4a928", "#6b4d0d", "hat"],
  ["robot-dog", "Perrito robot", "Compañero mecánico articulado con visor de neón.", "EPIC", "🐕", "#7dd3fc", "#164e63", "robot_dog"],
  ["sport-car", "Bólido escarlata", "Carro deportivo bajo, con cabina, alerón y ruedas visibles.", "RARE", "🏎️", "#ef4444", "#450a0a", "sport_car"],
  ["rubber-duck", "Patito de la fortuna", "Patito brillante con pico, alas y una confianza inexplicable.", "COMMON", "🐤", "#fde047", "#f97316", "duck"],
  ["elegant-cat", "Gato de sociedad", "Felino de porte elegante con orejas, cola y collar de lujo.", "RARE", "🐈", "#a78bfa", "#3b0764", "cat"],
  ["dingus-the-cat", "Dingus the Cat", "Figura GLB importada con textura propia y base adaptable al color del jugador.", "LEGENDARY", "🐈", "#fef3c7", "#7c2d12", "dingus_the_cat", {
    renderer: "gltf",
    assetKey: "dingus_the_cat",
    fallbackModel: "cat",
    fitSize: 1.95,
    colorLocked: true
  }],
  ["pikachu", "Pikachu", "Figura GLB legendaria con textura fija y silueta electrica.", "LEGENDARY", "⚡", "#facc15", "#78350f", "pikachu", {
    renderer: "gltf",
    assetKey: "pikachu",
    fallbackModel: "robot_dog",
    fitSize: 1.9,
    colorLocked: true
  }],
  ["snorlax", "Snorlax", "Figura GLB legendaria de gran volumen y textura fija.", "LEGENDARY", "●", "#334155", "#0f172a", "snorlax", {
    renderer: "gltf",
    assetKey: "snorlax",
    fallbackModel: "astronaut",
    fitSize: 1.9,
    colorLocked: true
  }],
  ["jigglypuff", "Jigglypuff", "Figura GLB legendaria de acabado suave y textura fija.", "LEGENDARY", "♪", "#f9a8d4", "#831843", "jigglypuff", {
    renderer: "gltf",
    assetKey: "jigglypuff",
    fallbackModel: "ghost",
    fitSize: 1.75,
    colorLocked: true
  }],
  ["tralalero-tralala", "Tralalero Tralala", "Figura GLB legendaria con textura fija para mesas de alto perfil.", "LEGENDARY", "★", "#38bdf8", "#075985", "tralalero_tralala", {
    renderer: "gltf",
    assetKey: "tralalero_tralala",
    fallbackModel: "dinosaur",
    fitSize: 2.05,
    colorLocked: true
  }],
  ["tung-tung-shakur", "Tung Tung Shakur", "Figura GLB legendaria con textura fija y presencia ceremonial.", "LEGENDARY", "◆", "#92400e", "#431407", "tung_tung_shakur", {
    renderer: "gltf",
    assetKey: "tung_tung_shakur",
    fallbackModel: "hat",
    fitSize: 2.05,
    colorLocked: true
  }],
  ["chicken", "Chicken", "Figura GLB legendaria con textura fija y postura compacta.", "LEGENDARY", "🐤", "#f97316", "#7c2d12", "chicken", {
    renderer: "gltf",
    assetKey: "chicken",
    fallbackModel: "duck",
    fitSize: 1.9,
    colorLocked: true
  }],
  
  ["mini-dino", "Tirano miniatura", "Dinosaurio compacto con cola, patas y cresta dorsal.", "EPIC", "🦖", "#4ade80", "#14532d", "dinosaur"],
  ["astronaut", "Magnate orbital", "Astronauta con casco, visor, mochila y traje presurizado.", "EPIC", "🚀", "#e2e8f0", "#334155", "astronaut"],
  ["neon-ghost", "Fantasma de neón", "Espectro translúcido con ojos luminosos y silueta flotante.", "EPIC", "👻", "#22d3ee", "#083344", "ghost"],
  ["baby-dragon", "Dragón banquero", "Dragón bebé con alas, cuernos, cola y obsesión por el oro.", "EPIC", "🐉", "#fb7185", "#881337", "dragon"],
  ["golden-taco", "Taco dorado", "Una inversión crujiente con tortilla dorada y relleno de lujo.", "EPIC", "🌮", "#fbbf24", "#16a34a", "taco"]
];

const diceDefinitions = [
  ["classic-white", "Dados clásicos blancos", "Marfil limpio con puntos oscuros.", "COMMON", "#fffdf6", "#3f2b17", 0.34, 0.04, 1],
  ["elegant-black", "Dados negros elegantes", "Negro mate con puntos dorados.", "RARE", "#111827", "#fbbf24", 0.28, 0.24, 1],
  ["gold", "Dados dorados", "Metal dorado pulido para tiradas importantes.", "EPIC", "#f5c542", "#3f2600", 0.2, 0.72, 1],
  ["neon-blue", "Dados neón azul", "Azul eléctrico con brillo interno.", "RARE", "#082f49", "#67e8f9", 0.24, 0.22, 1],
  ["fire", "Dados de fuego", "Ascuas oscuras con puntos incandescentes.", "EPIC", "#7f1d1d", "#fef08a", 0.4, 0.12, 1],
  ["ice", "Dados de hielo", "Cristal helado con reflejos celestes.", "EPIC", "#bae6fd", "#075985", 0.12, 0.35, 0.88],
  ["galactic", "Dados galácticos", "Una pequeña nebulosa en cada cara.", "LEGENDARY", "#312e81", "#f0abfc", 0.22, 0.38, 1],
  ["casino-red", "Dados de casino rojo", "Rojo clásico de mesa profesional.", "RARE", "#b91c1c", "#fff7ed", 0.3, 0.2, 1],
  ["transparent", "Dados transparentes", "Cuerpo de cristal casi invisible.", "EPIC", "#dbeafe", "#1e3a8a", 0.08, 0.15, 0.42],
  ["hacker", "Dados hacker glitch", "Verde terminal con errores deliberados.", "EPIC", "#052e16", "#4ade80", 0.32, 0.16, 1],
  ["lava", "Dados de lava", "Roca negra atravesada por magma.", "LEGENDARY", "#1c1917", "#fb923c", 0.48, 0.1, 1],
  ["ghost", "Dados fantasma", "Blancos espectrales y translúcidos.", "EPIC", "#ecfeff", "#22d3ee", 0.15, 0.12, 0.58],
  ["rainbow", "Dados arcoíris", "Color cambiante y puntos blancos.", "LEGENDARY", "#a855f7", "#ffffff", 0.24, 0.28, 1],
  ["diamond", "Dados de lujo diamante", "Facetado brillante de rareza legendaria.", "LEGENDARY", "#e0f2fe", "#0369a1", 0.06, 0.9, 0.82],
  ["wood", "Dados textura de madera", "Madera cálida con grabado oscuro.", "RARE", "#92400e", "#2a1205", 0.72, 0.02, 1]
];

const fxDefinitions = [
  ["gold-sparks", "Forja dorada", "Chispas rápidas rebotan y caen alrededor de cada dado.", "RARE", "sparks", "#fbbf24", "#fff7ae", 0.95],
  ["fire-trail", "Estela infernal", "Dos colas de brasas persiguen los dados durante toda la tirada.", "EPIC", "trail", "#fb451f", "#facc15", 1.15],
  ["ice-particles", "Fractura glacial", "Fragmentos azul hielo se separan con un movimiento cortante.", "RARE", "flakes", "#bae6fd", "#38bdf8", 0.9],
  ["glitch", "Ruptura digital", "Píxeles verdes saltan de posición en pulsos deliberadamente inestables.", "EPIC", "glitch", "#4ade80", "#22d3ee", 1.1],
  ["energy-waves", "Pulso de energía", "Anillos expansivos recorren la mesa debajo de los dados.", "EPIC", "waves", "#818cf8", "#22d3ee", 1.1],
  ["electric-rays", "Enlace eléctrico", "Descargas luminosas conectan ambos dados mientras se mueven.", "LEGENDARY", "electric", "#67e8f9", "#ffffff", 1.35],
  ["magic-dust", "Órbita arcana", "Partículas violetas forman espirales suaves alrededor de la tirada.", "EPIC", "orbit", "#c084fc", "#f0abfc", 1.08],
  ["landing-confetti", "Impacto festivo", "El resultado libera una lluvia breve y colorida de confeti.", "RARE", "confetti", "#f472b6", "#fde047", 0.95],
  ["galactic-trail", "Vórtice galáctico", "Estrellas y nebulosa giran como una pequeña galaxia.", "LEGENDARY", "galaxy", "#8b5cf6", "#38bdf8", 1.35],
  ["legendary-flash", "Juicio legendario", "Un destello dorado y una corona de luz anuncian el resultado.", "LEGENDARY", "flash", "#fef08a", "#f59e0b", 1.4]
];

const boardDefinitions = [
  ["classic-deluxe", "Clásico de lujo", "Madera oscura, paño verde y detalles dorados.", "RARE", "▦", "#2d2418", "#1f6f59", "#f4d45d", 0.62, 0.16],
  ["casino-noir", "Casino Noir", "Negro carbón con centro vino y líneas de oro tenue.", "EPIC", "◆", "#080b10", "#3f0d1a", "#d4a928", 0.3, 0.48],
  ["neon-city", "Ciudad neón", "Tablero nocturno cyan y magenta con acabado tecnológico.", "EPIC", "⌗", "#071827", "#082f49", "#22d3ee", 0.24, 0.38],
  ["aztec-gold", "Tesoro solar", "Piedra turquesa y oro inspirados en una cámara ceremonial.", "LEGENDARY", "☀", "#3f2d16", "#0f766e", "#fbbf24", 0.54, 0.42],
  ["arctic-vault", "Bóveda ártica", "Hielo azul, plata y una superficie limpia de cristal frío.", "EPIC", "❄", "#29465b", "#dbeafe", "#67e8f9", 0.16, 0.62],
  ["galactic-empire", "Imperio galáctico", "Azul profundo, violeta cósmico y bordes de luz estelar.", "LEGENDARY", "✦", "#11133b", "#312e81", "#c084fc", 0.2, 0.5]
];

function priceFor(rarity, index) {
  return rarityPrices[rarity] + (index % 4) * 10;
}

const monopolyProducts = [
  ...tokenDefinitions.map(([slug, name, description, rarity, glyph, color, ring, model, metadata = {}], index) => ({
    id: `monopoly-token-${slug}`,
    slug,
    name,
    description,
    priceUnits: priceFor(rarity, index),
    gameKey: "MONOPOLY",
    category: "TOKEN",
    slotKey: "TOKEN",
    rarity,
    preview: glyph,
    metadata: { renderer: "primitive", model, glyph, color, ring, ...metadata }
  })),
  ...diceDefinitions.map(([slug, name, description, rarity, baseColor, pipColor, roughness, metalness, opacity], index) => ({
    id: `monopoly-dice-${slug}`,
    slug,
    name,
    description,
    priceUnits: priceFor(rarity, index),
    gameKey: "MONOPOLY",
    category: "DICE",
    slotKey: "DICE",
    rarity,
    preview: "⚄",
    metadata: {
      baseColor,
      pipColor,
      roughness,
      metalness,
      opacity,
      transparent: opacity < 1,
      fxCompatible: true
    }
  })),
  ...fxDefinitions.map(([slug, name, description, rarity, effect, color, secondaryColor, intensity], index) => ({
    id: `monopoly-dice-fx-${slug}`,
    slug,
    name,
    description,
    priceUnits: priceFor(rarity, index),
    gameKey: "MONOPOLY",
    category: "DICE_FX",
    slotKey: "DICE_FX",
    rarity,
    preview: "✦",
    metadata: { effect, color, secondaryColor, intensity }
  })),
  ...boardDefinitions.map(([slug, name, description, rarity, glyph, baseColor, centerColor, accentColor, roughness, metalness], index) => ({
    id: `monopoly-board-${slug}`,
    slug,
    name,
    description,
    priceUnits: priceFor(rarity, index + 2),
    gameKey: "MONOPOLY",
    category: "BOARD_THEME",
    slotKey: "BOARD_THEME",
    rarity,
    preview: glyph,
    metadata: {
      baseColor,
      centerColor,
      accentColor,
      roughness,
      metalness
    }
  }))
];

const allProducts = [...monopolyProducts];

module.exports = {
  allProducts,
  gameDefinitions,
  monopolyProducts
};

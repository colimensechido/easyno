PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS eycon_accounts (
  user_id INTEGER PRIMARY KEY,
  balance_units INTEGER NOT NULL DEFAULT 0 CHECK(balance_units >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eycon_movements (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  amount_units INTEGER NOT NULL CHECK(amount_units <> 0),
  movement_type TEXT NOT NULL,
  balance_before INTEGER NOT NULL CHECK(balance_before >= 0),
  balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
  game_key TEXT,
  reference_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eycon_movements_user_date
  ON eycon_movements(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eycon_movements_reference
  ON eycon_movements(reference_id);

CREATE TABLE IF NOT EXISTS eycon_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_units INTEGER NOT NULL CHECK(price_units >= 0),
  game_key TEXT NOT NULL,
  category TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  rarity TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  preview TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_key, category, slug)
);

CREATE TABLE IF NOT EXISTS eycon_inventory (
  user_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  purchase_price_units INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'STORE',
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES eycon_products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eycon_equipment (
  user_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  product_id TEXT NOT NULL,
  equipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_key, slot_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES eycon_products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eycon_wagers (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  stake_units INTEGER NOT NULL CHECK(stake_units > 0),
  payout_units INTEGER NOT NULL DEFAULT 0 CHECK(payout_units >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

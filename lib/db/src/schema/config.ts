import { pgTable, varchar, timestamp, integer, serial, jsonb, text } from "drizzle-orm/pg-core";

export const siteConfigTable = pgTable("site_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SiteConfig = typeof siteConfigTable.$inferSelect;

/**
 * Tracks Replit follower count over time.
 * Used to compute "new followers (signups proxy)" since a given period.
 * Replit's public API does not expose app-level user signups;
 * follower growth is the best available engagement/growth metric.
 */
export const replitFollowerSnapshotsTable = pgTable("replit_follower_snapshots", {
  id: serial("id").primaryKey(),
  followerCount: integer("follower_count").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReplitFollowerSnapshot = typeof replitFollowerSnapshotsTable.$inferSelect;

export const revooWaitlistTable = pgTable("revoo_waitlist", {
  id: serial("id").primaryKey(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  googleBusinessUrl: varchar("google_business_url", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  notes: varchar("notes", { length: 1000 }),
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RevooWaitlistEntry = typeof revooWaitlistTable.$inferSelect;
export type InsertRevooWaitlistEntry = typeof revooWaitlistTable.$inferInsert;

export const permitradarCityRequestsTable = pgTable("permitradar_city_requests", {
  id: serial("id").primaryKey(),
  cityName: varchar("city_name", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("US"),
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  reason: varchar("reason", { length: 1000 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PermitRadarCityRequest = typeof permitradarCityRequestsTable.$inferSelect;
export type InsertPermitRadarCityRequest = typeof permitradarCityRequestsTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────
// Kowalski Trading Engine tables
// ─────────────────────────────────────────────────────────────────

// Flow alerts from Unusual Whales
export const flowAlertsTable = pgTable("flow_alerts", {
  id: varchar("id", { length: 100 }).primaryKey(), // UW alert ID
  ticker: varchar("ticker", { length: 20 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(), // call/put
  premium: integer("premium").notNull(),
  dte: integer("dte").notNull(),
  strike: integer("strike"),
  expiry: varchar("expiry", { length: 20 }),
  ivRank: integer("iv_rank"),
  delta: varchar("delta", { length: 10 }),
  uwSignals: jsonb("uw_signals").notNull().default([]),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FlowAlert = typeof flowAlertsTable.$inferSelect;
export type InsertFlowAlert = typeof flowAlertsTable.$inferInsert;

// Kowalski's analysis/decision on each signal
export const signalDecisionsTable = pgTable("signal_decisions", {
  id: serial("id").primaryKey(),
  alertId: varchar("alert_id", { length: 100 }).notNull().references(() => flowAlertsTable.id),
  decision: varchar("decision", { length: 10 }).notNull(), // TAKE / SKIP
  reasoning: text("reasoning").notNull(),
  score: integer("score"), // 0-100 Kowalski's confidence
  rejectionReason: varchar("rejection_reason", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SignalDecision = typeof signalDecisionsTable.$inferSelect;
export type InsertSignalDecision = typeof signalDecisionsTable.$inferInsert;

// Open options positions
export const optionsPositionsTable = pgTable("options_positions", {
  id: serial("id").primaryKey(),
  alertId: varchar("alert_id", { length: 100 }),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  optionSymbol: varchar("option_symbol", { length: 30 }).notNull(),
  direction: varchar("direction", { length: 10 }).notNull(),
  strike: integer("strike").notNull(),
  expiry: varchar("expiry", { length: 20 }).notNull(),
  contracts: integer("contracts").notNull(),
  entryPrice: varchar("entry_price", { length: 20 }).notNull(),
  stopPrice: varchar("stop_price", { length: 20 }).notNull(),
  t1Price: varchar("t1_price", { length: 20 }).notNull(),
  t2Price: varchar("t2_price", { length: 20 }).notNull(),
  currentPrice: varchar("current_price", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open/closed
  t1Hit: integer("t1_hit").default(0), // 0=false, 1=true
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closeReason: varchar("close_reason", { length: 100 }),
  pnlDollars: varchar("pnl_dollars", { length: 20 }),
  pnlPct: varchar("pnl_pct", { length: 20 }),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OptionsPosition = typeof optionsPositionsTable.$inferSelect;
export type InsertOptionsPosition = typeof optionsPositionsTable.$inferInsert;

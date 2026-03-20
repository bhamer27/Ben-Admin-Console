import { pgTable, varchar, timestamp, integer, serial } from "drizzle-orm/pg-core";

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

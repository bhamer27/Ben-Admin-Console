import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const siteConfigTable = pgTable("site_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SiteConfig = typeof siteConfigTable.$inferSelect;

import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  ticker: text("ticker").notNull(),
  side: text("side").notNull(),
  strategy: text("strategy"),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  shares: integer("shares").notNull(),
  notes: text("notes"),
  netPnl: real("net_pnl").notNull(),
  rr: real("rr").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;

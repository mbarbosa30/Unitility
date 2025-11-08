import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pools = pgTable("pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 2 }).notNull(),
  ethDeposited: decimal("eth_deposited", { precision: 18, scale: 6 }).notNull(),
  feesEarned: decimal("fees_earned", { precision: 18, scale: 6 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  gasPrice: decimal("gas_price", { precision: 18, scale: 8 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 6 }).notNull(),
  poolId: varchar("pool_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertPoolSchema = createInsertSchema(pools).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  timestamp: true,
});

export type InsertPool = z.infer<typeof insertPoolSchema>;
export type Pool = typeof pools.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

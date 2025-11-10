import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pools = pgTable("pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractAddress: text("contract_address").notNull().unique(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name").notNull(),
  decimals: integer("decimals").notNull().default(18),
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 2 }).notNull(),
  minTokensPerTransfer: decimal("min_tokens_per_transfer", { precision: 18, scale: 6 }).notNull().default("1"),
  ethDeposited: decimal("eth_deposited", { precision: 18, scale: 6 }).notNull(),
  feesEarned: decimal("fees_earned", { precision: 18, scale: 6 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 5, scale: 2 }).notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  gasPrice: decimal("gas_price", { precision: 18, scale: 8 }).notNull(),
  sponsor: text("sponsor").notNull(),
  chainId: integer("chain_id"),
  blockNumber: integer("block_number"),
  transactionHash: text("transaction_hash"),
  cumulativeGasBurned: decimal("cumulative_gas_burned", { precision: 18, scale: 6 }).notNull().default("0"),
  totalSupply: decimal("total_supply", { precision: 30, scale: 0 }),
  impliedPrice: decimal("implied_price", { precision: 18, scale: 12 }),
  intendedFdv: decimal("intended_fdv", { precision: 30, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  contractAddressIdx: index("pools_contract_address_idx").on(table.contractAddress),
  transactionHashIdx: index("pools_transaction_hash_idx").on(table.transactionHash),
  blockNumberIdx: index("pools_block_number_idx").on(table.blockNumber),
  createdAtIdx: index("pools_created_at_idx").on(table.createdAt),
}));

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  fee: decimal("fee", { precision: 18, scale: 6 }).notNull(),
  poolId: varchar("pool_id").notNull(),
  gasCost: decimal("gas_cost", { precision: 18, scale: 6 }),
  transactionHash: text("transaction_hash"),
  blockNumber: integer("block_number"),
  chainId: integer("chain_id"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  poolIdIdx: index("transactions_pool_id_idx").on(table.poolId),
  transactionHashIdx: index("transactions_transaction_hash_idx").on(table.transactionHash),
  blockNumberIdx: index("transactions_block_number_idx").on(table.blockNumber),
  timestampIdx: index("transactions_timestamp_idx").on(table.timestamp),
}));

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

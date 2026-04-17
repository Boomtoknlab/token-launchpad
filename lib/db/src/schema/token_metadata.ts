import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokenMetadataTable = pgTable("token_metadata", {
  tokenAddress: text("token_address").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  twitter: text("twitter").notNull().default(""),
  telegram: text("telegram").notNull().default(""),
  website: text("website").notNull().default(""),
  creatorAddress: text("creator_address").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTokenMetadataSchema = createInsertSchema(tokenMetadataTable).omit({
  createdAt: true,
});

export type InsertTokenMetadata = z.infer<typeof insertTokenMetadataSchema>;
export type TokenMetadata = typeof tokenMetadataTable.$inferSelect;

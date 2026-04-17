import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tokenCommentsTable = pgTable("token_comments", {
  id: serial("id").primaryKey(),
  tokenAddress: text("token_address").notNull(),
  commenterAddress: text("commenter_address").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTokenCommentSchema = createInsertSchema(tokenCommentsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTokenComment = z.infer<typeof insertTokenCommentSchema>;
export type TokenComment = typeof tokenCommentsTable.$inferSelect;

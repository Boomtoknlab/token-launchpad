import { Router } from "express";
import { db } from "@workspace/db";
import {
  tokenMetadataTable,
  tokenCommentsTable,
  insertTokenMetadataSchema,
  insertTokenCommentSchema,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

router.get("/tokens/:address/metadata", async (req, res) => {
  const { address } = req.params;
  if (!isValidAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const rows = await db
    .select()
    .from(tokenMetadataTable)
    .where(eq(tokenMetadataTable.tokenAddress, address.toLowerCase()))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(rows[0]);
});

router.post("/tokens/:address/metadata", async (req, res) => {
  const { address } = req.params;
  if (!isValidAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const parsed = insertTokenMetadataSchema.safeParse({
    ...req.body,
    tokenAddress: address.toLowerCase(),
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  await db
    .insert(tokenMetadataTable)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: tokenMetadataTable.tokenAddress,
      set: {
        description: parsed.data.description,
        imageUrl: parsed.data.imageUrl,
        twitter: parsed.data.twitter,
        telegram: parsed.data.telegram,
        website: parsed.data.website,
      },
    });
  res.json({ ok: true });
});

router.get("/tokens/:address/comments", async (req, res) => {
  const { address } = req.params;
  if (!isValidAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const rows = await db
    .select()
    .from(tokenCommentsTable)
    .where(eq(tokenCommentsTable.tokenAddress, address.toLowerCase()))
    .orderBy(desc(tokenCommentsTable.createdAt))
    .limit(100);
  res.json(rows);
});

router.post("/tokens/:address/comments", async (req, res) => {
  const { address } = req.params;
  if (!isValidAddress(address)) {
    res.status(400).json({ error: "Invalid address" });
    return;
  }
  const content = (req.body.content ?? "").trim();
  const commenterAddress = (req.body.commenterAddress ?? "").toLowerCase();
  if (!content || content.length > 500) {
    res.status(400).json({ error: "Content must be 1-500 chars" });
    return;
  }
  if (!isValidAddress(commenterAddress)) {
    res.status(400).json({ error: "Invalid commenter address" });
    return;
  }
  const parsed = insertTokenCommentSchema.safeParse({
    tokenAddress: address.toLowerCase(),
    commenterAddress,
    content,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const [row] = await db.insert(tokenCommentsTable).values(parsed.data).returning();
  res.json(row);
});

export default router;

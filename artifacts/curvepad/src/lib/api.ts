const API_BASE = "/api";

export interface TokenMeta {
  tokenAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter: string;
  telegram: string;
  website: string;
  creatorAddress: string;
  createdAt: string;
}

export interface TokenComment {
  id: number;
  tokenAddress: string;
  commenterAddress: string;
  content: string;
  createdAt: string;
}

export async function getTokenMetadata(address: string): Promise<TokenMeta | null> {
  try {
    const res = await fetch(`${API_BASE}/tokens/${address}/metadata`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveTokenMetadata(
  address: string,
  data: Omit<TokenMeta, "tokenAddress" | "createdAt">
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/tokens/${address}/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, tokenAddress: address }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getTokenComments(address: string): Promise<TokenComment[]> {
  try {
    const res = await fetch(`${API_BASE}/tokens/${address}/comments`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function postTokenComment(
  address: string,
  commenterAddress: string,
  content: string
): Promise<TokenComment | null> {
  try {
    const res = await fetch(`${API_BASE}/tokens/${address}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commenterAddress, content }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

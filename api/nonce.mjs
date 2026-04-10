import crypto from "node:crypto";
  import { rateLimit } from "./_rateLimit.mjs";

  const nonceStore = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of nonceStore) {
      if (now > v.expires) nonceStore.delete(k);
    }
  }, 60000);

  export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    if (rateLimit(req, { max: 30, windowMs: 60000 }).limited) {
      return res.status(429).json({ error: "Demasiadas solicitudes." });
    }

    const nonce = crypto.randomUUID().replace(/-/g, "");
    nonceStore.set(nonce, { expires: Date.now() + 5 * 60 * 1000 });

    return res.status(200).json({ nonce });
  }

  export function consumeNonce(nonce) {
    const entry = nonceStore.get(nonce);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      nonceStore.delete(nonce);
      return false;
    }
    nonceStore.delete(nonce);
    return true;
  }
  
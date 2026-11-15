import { sendMessage } from "../lib/send.mjs";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  let data = req.body;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return res.status(400).json({ error: "Données invalides." });
    }
  }

  const out = await sendMessage(data || {});
  return res.status(out.status).json(out.data);
}
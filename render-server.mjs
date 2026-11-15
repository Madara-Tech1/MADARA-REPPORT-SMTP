import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendMessage } from "./lib/send.mjs";

const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "10kb" }));

app.post("/api/send-email", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const out = await sendMessage(req.body || {});
  res.status(out.status).json(out.data);
});

app.all("/api/send-email", (req, res) => {
  res.status(405).json({ error: "Méthode non autorisée." });
});

app.use(express.static(path.join(dir, "public")));

// JSON invalide
app.use((err, req, res, next) => {
  res.status(400).json({ error: "Données invalides." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("MADARA HUB sur le port " + PORT);
});
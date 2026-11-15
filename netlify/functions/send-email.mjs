import { sendMessage } from "../../lib/send.mjs";

const json = (statusCode, data) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(data)
});

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Méthode non autorisée." });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Données invalides." });
  }

  const out = await sendMessage(data);
  return json(out.status, out.data);
}
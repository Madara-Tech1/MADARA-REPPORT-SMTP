import { RECIPIENTS, SUBJECT } from "./config.mjs";
import { MESSAGES } from "./messages.mjs";

const MAX_ACCOUNTS = 5;

const reply = (status, data) => ({ status, data });

function getKeys(env) {
  const keys = [];
  for (let i = 1; i <= MAX_ACCOUNTS; i++) {
    const k = env["BREVO" + i + "_KEY"] || (i === 1 ? env["BREVO_KEY"] : undefined);
    const f = env["BREVO" + i + "_FROM"] || (i === 1 ? env["BREVO_FROM"] : undefined);
    if (k && f) keys.push({ key: k, from: f, index: i });
  }
  return keys;
}

export async function sendMessage(data) {
  const env = process.env;

  if (env.ACCESS_KEY && data.key !== env.ACCESS_KEY) {
    return reply(401, { error: "Clé d'accès incorrecte." });
  }

  const number = String(data.number || "").replace(/\D/g, "");
  if (number.length < 7 || number.length > 15) {
    return reply(400, { error: "Numéro invalide." });
  }

  const accounts = getKeys(env);
  if (!accounts.length) {
    return reply(503, { error: "Configuration Brevo incomplète." });
  }

  const total      = accounts.length;
  const totalTexts = MESSAGES.length;

  if (!totalTexts) {
    return reply(500, { error: "Aucun texte dans messages.mjs.", total, total_texts: 0 });
  }

  const brevoIndex = Math.max(1, parseInt(data.smtp, 10) || 1);
  const textIndex  = Math.max(1, parseInt(data.textIndex, 10) || 1);

  if (brevoIndex > total) {
    return reply(400, { error: "Compte Brevo inconnu.", total, total_texts: totalTexts });
  }
  if (textIndex > totalTexts) {
    return reply(400, { error: "Texte inconnu.", total, total_texts: totalTexts });
  }

  const acc = accounts[brevoIndex - 1];

  const recipients = [...new Set(RECIPIENTS.map((a) => a.trim().toLowerCase()))];
  if (!recipients.length) {
    return reply(500, { error: "Aucun destinataire.", total, total_texts: totalTexts });
  }

  const rawText = MESSAGES[textIndex - 1];
  const text    = rawText.replaceAll("{number}", number);

  const preview = rawText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0)
    ?.replaceAll("{number}", number)
    .slice(0, 55) || "";

  const results = await Promise.allSettled(
    recipients.map((to) =>
      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": acc.key
        },
        body: JSON.stringify({
          sender:      { email: acc.from },
          to:          [{ email: to }],
          subject:     SUBJECT,
          textContent: text
        })
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "HTTP " + res.status);
        }
        return res.json();
      })
    )
  );

  results.forEach((r) => {
    if (r.status === "rejected") {
      console.error("Brevo " + brevoIndex + " / TEXT " + textIndex + ":", r.reason?.message);
    }
  });

  const sent = results.filter((r) => r.status === "fulfilled").length;

  if (!sent) {
    return reply(502, {
      error: "Brevo " + brevoIndex + " texte " + textIndex + " : envoi impossible.",
      smtp: brevoIndex, text: textIndex, total, total_texts: totalTexts, preview
    });
  }

  return reply(200, {
    success: true,
    smtp: brevoIndex,
    text: textIndex,
    total,
    total_texts: totalTexts,
    sent,
    failed: recipients.length - sent,
    recipients: recipients.length,
    preview
  });
}

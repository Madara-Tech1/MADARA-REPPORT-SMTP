import nodemailer from "nodemailer";
import { RECIPIENTS, SUBJECT } from "./config.mjs";
import { MESSAGES } from "./messages.mjs";

const reply = (status, data) => ({ status, data });

export async function sendMessage(data) import nodemailer from "nodemailer";
import { RECIPIENTS, SUBJECT } from "./config.mjs";
import { MESSAGES } from "./messages.mjs";

const reply = (status, data) => ({ status, data });

export async function sendMessage(data) {
  const env = process.env;

  // Clé d'accès (optionnelle) : définis ACCESS_KEY pour protéger le panneau.
  if (env.ACCESS_KEY && data.key !== env.ACCESS_KEY) {
    return reply(401, { error: "Clé d'accès incorrecte." });
  }

  const number = String(data.number || "").replace(/\D/g, "");
  if (number.length < 7 || number.length > 15) {
    return reply(400, { error: "Numéro invalide." });
  }

  if (!MESSAGES.length) {
    return reply(500, { error: "Aucun texte dans messages.mjs." });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return reply(503, { error: "Configuration SMTP incomplète." });
  }

  const port = Number(SMTP_PORT || 587);
  if (![465, 587].includes(port)) {
    return reply(500, { error: "Port SMTP non autorisé." });
  }

  const template = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const text = template.replaceAll("{number}", number);

  const list = [...new Set(RECIPIENTS.map((a) => a.trim().toLowerCase()))];

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  try {
    // Envoi en parallèle : un e-mail séparé par destinataire.
    const results = await Promise.allSettled(
      list.map((to) =>
        transporter.sendMail({ from: SMTP_FROM, to, subject: SUBJECT, text })
      )
    );

    results.forEach((r) => {
      if (r.status === "rejected") {
        console.error("SMTP error:", r.reason && r.reason.message);
      }
    });

    const sent = results.filter((r) => r.status === "fulfilled").length;

    if (!sent) {
      return reply(502, { error: "Le serveur SMTP n'a pas pu envoyer le message." });
    }
    return reply(200, { success: true, sent });
  } finally {
    transporter.close();
  }
}
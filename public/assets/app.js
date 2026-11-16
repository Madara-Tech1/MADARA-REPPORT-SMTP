"use strict";

// ⚠️ Remplace par le lien de TA chaîne WhatsApp
const CHANNEL_URL = "https://whatsapp.com/channel/0029VbAzHEiA2pLFh3XWps0x";
const MIN_SECONDS = 10;       // temps minimum après avoir quitté la page
const FALLBACK_SECONDS = 30;  // si la sortie de page n'est pas détectée
const COOLDOWN_SECONDS = 30;  // pause entre deux envois
const GATE_EXPIRE_MS = 5 * 60 * 1000; // reprise possible pendant 5 minutes
const GATE_KEY = "madara_gate";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Terminal animé ----------
function createTerminal(body) {
  let chain = Promise.resolve();
  return {
    clear() {
      chain = chain.then(() => { body.innerHTML = ""; });
      return chain;
    },
    print(text, cls = "") {
      chain = chain.then(async () => {
        const line = document.createElement("div");
        line.className = "line " + cls;

        const prompt = document.createElement("span");
        prompt.className = "prompt";
        prompt.textContent = "$ ";

        const content = document.createElement("span");
        content.className = "content";

        line.append(prompt, content);
        body.appendChild(line);

        for (const ch of text) {
          content.textContent += ch;
          body.scrollTop = body.scrollHeight;
          await sleep(25);
        }
        await sleep(250);
      });
      return chain;
    }
  };
}

// ---------- Éléments ----------
const gate = document.getElementById("gate");
const panel = document.getElementById("panel");
const channelLink = document.getElementById("channelLink");
const verifyBtn = document.getElementById("verifyBtn");
const gateInfo = document.getElementById("gateInfo");

const form = document.getElementById("form");
const result = document.getElementById("result");
const btn = document.getElementById("btn");
const bar = document.getElementById("bar");
const historyList = document.getElementById("historyList");

const gateTerm = createTerminal(document.getElementById("gateBody"));
const term = createTerminal(document.getElementById("termBody"));

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function setBar(percent, isError = false) {
  bar.style.width = percent + "%";
  bar.className = isError ? "err" : "";
}

// ---------- Authentification chaîne WhatsApp ----------
channelLink.href = CHANNEL_URL;

function unlock() {
  gate.hidden = true;
  panel.hidden = false;
  renderHistory();
  term.print("[READY] entre un numéro puis envoie");
}

let clickedAt = 0;
let leftPage = false;
let gateTimer = null;

// Sauvegarde de l'étape pour pouvoir reprendre après un retour sur le site
function saveGate() {
  localStorage.setItem(GATE_KEY, JSON.stringify({ clickedAt, leftPage }));
}

function clearGate() {
  localStorage.removeItem(GATE_KEY);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && clickedAt) {
    leftPage = true;
    saveGate();
  }
});

function checkGate() {
  const sec = (Date.now() - clickedAt) / 1000;
  const ready = (leftPage && sec >= MIN_SECONDS) || sec >= FALLBACK_SECONDS;

  if (ready) {
    clearInterval(gateTimer);
    verifyBtn.disabled = false;
    gateInfo.textContent = "Tu peux maintenant valider.";
    gateTerm.print("[READY] clique sur J'AI REJOINT", "ok");
  } else {
    gateInfo.textContent = leftPage
      ? "Encore quelques secondes..."
      : "Ouvre la chaîne et rejoins-la...";
  }
}

channelLink.addEventListener("click", () => {
  if (clickedAt) return;
  clickedAt = Date.now();
  saveGate();
  gateTerm.print("[LINK] chaîne ouverte");
  gateTerm.print("[WAIT] reviens ici après avoir rejoint");
  gateTimer = setInterval(checkGate, 500);
});

verifyBtn.addEventListener("click", async () => {
  verifyBtn.disabled = true;
  await gateTerm.print("[CHECK] vérification...");
  await gateTerm.print("[CHANNEL] OK");
  await gateTerm.print("[ACCESS GRANTED]", "ok");
  clearGate(); // rien n'est gardé : au prochain accès, on redemande
  gate.classList.add("leaving");
  await sleep(500);
  unlock();
});

// ---------- Démarrage : on demande toujours de rejoindre la chaîne ----------
// Efface l'ancienne validation mémorisée par les versions précédentes.
localStorage.removeItem("madara_verified");

(function startGate() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(GATE_KEY) || "null");
  } catch {
    saved = null;
  }

  if (saved && saved.clickedAt && Date.now() - saved.clickedAt < GATE_EXPIRE_MS) {
    // La personne est partie sur la chaîne il y a moins de 5 min : on reprend.
    clickedAt = saved.clickedAt;
    leftPage = true;
    saveGate();
    gateInfo.textContent = "Reprise de la vérification...";
    gateTerm.print("[RESUME] reprise de la vérification");
    gateTimer = setInterval(checkGate, 500);
  } else {
    clearGate();
    gateTerm.print("[LOCKED] chaîne WhatsApp requise");
  }
})();

// ---------- Historique ----------
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("madara_history") || "[]");
  } catch {
    return [];
  }
}

function addHistory(number) {
  const list = getHistory().filter((n) => n !== number);
  list.unshift(number);
  localStorage.setItem("madara_history", JSON.stringify(list.slice(0, 5)));
  renderHistory();
}

function renderHistory() {
  const list = getHistory();
  historyList.innerHTML = "";

  if (!list.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Aucun envoi pour le moment.";
    historyList.appendChild(li);
    return;
  }

  list.forEach((n) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = n;

    const use = document.createElement("button");
    use.type = "button";
    use.textContent = "UTILISER";
    use.addEventListener("click", () => {
      document.getElementById("number").value = n;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    li.append(span, use);
    historyList.appendChild(li);
  });
}

// ---------- Envoi ----------
function show(text, type) {
  result.textContent = text;
  result.className = type;
}

function startCooldown() {
  let left = COOLDOWN_SECONDS;
  btn.disabled = true;
  btn.textContent = "ATTENDS " + left + " s";

  const timer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "ENVOYER";
    } else {
      btn.textContent = "ATTENDS " + left + " s";
    }
  }, 1000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const number = document.getElementById("number").value.replace(/\D/g, "");
  const key = document.getElementById("key").value;

  if (number.length < 7 || number.length > 15) {
    show("Numéro invalide (7 à 15 chiffres).", "error");
    shake(form);
    term.clear();
    term.print("[ERROR] numéro invalide", "err");
    return;
  }

  btn.disabled = true;
  btn.textContent = "ENVOI...";
  show("", "");
  setBar(0);
  term.clear();

  // La requête part tout de suite, le terminal s'anime pendant ce temps.
  const request = fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ number, key })
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    })
    .catch(() => ({ ok: false, data: { error: "Réseau indisponible." } }));

  await term.print("[START]");
  setBar(25);
  await term.print("[TARGET → " + number + "]");
  setBar(55);
  await term.print("[SEND 1]");
  setBar(80);

  const out = await request;

  if (out.ok) {
    await term.print("[SUCCESS ✔️]", "ok");
    setBar(100);
    show("Envoyé (" + out.data.sent + " e-mail).", "success");
    addHistory(number);
    document.getElementById("number").value = "";
    startCooldown();
  } else {
    const msg = (out.data && out.data.error) || "Échec de l'envoi.";
    await term.print("[ERROR] " + msg, "err");
    setBar(100, true);
    show(msg, "error");
    shake(form);
    btn.disabled = false;
    btn.textContent = "ENVOYER";
  }
});

"use strict";

// ⚠️ Remplace par le lien de TA chaîne WhatsApp
const CHANNEL_URL = "https://whatsapp.com/channel/0029VbAzHEiA2pLFh3XWps0x";
const MIN_SECONDS      = 10;
const FALLBACK_SECONDS = 30;
const COOLDOWN_SECONDS = 30;
const GATE_EXPIRE_MS   = 5 * 60 * 1000;
const GATE_KEY         = "madara_gate";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createTerminal(body) {
  let chain = Promise.resolve();
  return {
    clear() {
      chain = chain.then(() => { body.innerHTML = ""; });
      return chain;
    },
    print(text, cls = "") {
      chain = chain.then(async () => {
        const line     = document.createElement("div");
        line.className = "line " + cls;
        const prompt   = document.createElement("span");
        prompt.className   = "prompt";
        prompt.textContent = "$ ";
        const content  = document.createElement("span");
        content.className  = "content";
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

const gate        = document.getElementById("gate");
const panel       = document.getElementById("panel");
const channelLink = document.getElementById("channelLink");
const verifyBtn   = document.getElementById("verifyBtn");
const gateInfo    = document.getElementById("gateInfo");
const form        = document.getElementById("form");
const result      = document.getElementById("result");
const btn         = document.getElementById("btn");
const bar         = document.getElementById("bar");
const historyList = document.getElementById("historyList");
const gateTerm    = createTerminal(document.getElementById("gateBody"));
const term        = createTerminal(document.getElementById("termBody"));

function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
function setBar(percent, isError = false) {
  bar.style.width = percent + "%";
  bar.className   = isError ? "err" : "";
}

// ---------- Gate WhatsApp ----------
channelLink.href = CHANNEL_URL;

function unlock() {
  gate.hidden  = true;
  panel.hidden = false;
  renderHistory();
  term.print("[READY] entre un numéro puis envoie");
}

let clickedAt = 0, leftPage = false, gateTimer = null;

function saveGate()  { localStorage.setItem(GATE_KEY, JSON.stringify({ clickedAt, leftPage })); }
function clearGate() { localStorage.removeItem(GATE_KEY); }

document.addEventListener("visibilitychange", () => {
  if (document.hidden && clickedAt) { leftPage = true; saveGate(); }
});

function checkGate() {
  const sec   = (Date.now() - clickedAt) / 1000;
  const ready = (leftPage && sec >= MIN_SECONDS) || sec >= FALLBACK_SECONDS;
  if (ready) {
    clearInterval(gateTimer);
    verifyBtn.disabled   = false;
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
  clearGate();
  gate.classList.add("leaving");
  await sleep(500);
  unlock();
});

localStorage.removeItem("madara_verified");

(function startGate() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(GATE_KEY) || "null"); } catch { saved = null; }
  if (saved && saved.clickedAt && Date.now() - saved.clickedAt < GATE_EXPIRE_MS) {
    clickedAt = saved.clickedAt; leftPage = true; saveGate();
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
  try { return JSON.parse(localStorage.getItem("madara_history") || "[]"); } catch { return []; }
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
    li.className   = "empty";
    li.textContent = "Aucun envoi pour le moment.";
    historyList.appendChild(li);
    return;
  }
  list.forEach((n) => {
    const li   = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = n;
    const use  = document.createElement("button");
    use.type        = "button";
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
function show(text, type) { result.textContent = text; result.className = type; }

function startCooldown() {
  let left = COOLDOWN_SECONDS;
  btn.disabled    = true;
  btn.textContent = "ATTENDS " + left + " s";
  const timer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(timer);
      btn.disabled    = false;
      btn.textContent = "ENVOYER";
    } else {
      btn.textContent = "ATTENDS " + left + " s";
    }
  }, 1000);
}

async function callOne(number, key, brevo, textIndex) {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, key, smtp: brevo, textIndex })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Réseau indisponible." } };
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const number = document.getElementById("number").value.replace(/\D/g, "");
  const key    = document.getElementById("key").value;

  if (number.length < 7 || number.length > 15) {
    show("Numéro invalide (7 à 15 chiffres).", "error");
    shake(form); term.clear();
    term.print("[ERROR] numéro invalide", "err");
    return;
  }

  btn.disabled    = true;
  btn.textContent = "ENVOI...";
  show("", ""); setBar(0); term.clear();

  await term.print("[START]");
  await term.print("[TARGET → " + number + "]");
  setBar(5);

  let totalBrevo = 1, totalTexts = 1, infoSet = false;
  let totalSent  = 0, brevoOk = 0, lastError = "", abort = false;
  const totalCalls = () => totalBrevo * totalTexts;

  for (let b = 1; b <= totalBrevo && !abort; b++) {
    for (let t = 1; t <= totalTexts && !abort; t++) {

      await term.print(
        "[BREVO " + b + (totalBrevo > 1 ? "/" + totalBrevo : "") +
        " / TEXT " + t + "/" + totalTexts + "] → sending..."
      );

      const out = await callOne(number, key, b, t);

      if (!infoSet && out.data) {
        totalBrevo = out.data.total       || totalBrevo;
        totalTexts = out.data.total_texts || totalTexts;
        infoSet    = true;
      }

      if (out.ok) {
        totalSent += out.data.sent || 0;
        if (t === totalTexts) brevoOk++;

        const preview = out.data.preview
          ? out.data.preview + (out.data.preview.length >= 55 ? "..." : "")
          : "";
        await term.print(
          "[TEXT " + t + "] " + preview + "  ✓ " + out.data.sent + " e-mails",
          "ok"
        );
      } else {
        lastError = (out.data && out.data.error) || "Échec de l'envoi.";
        const preview = out.data?.preview ? " | " + out.data.preview : "";
        await term.print(
          "[TEXT " + t + "] ERR → " + lastError + preview,
          "err"
        );
        if ([400, 401, 503].includes(out.status)) { abort = true; break; }
      }

      setBar(5 + Math.round(90 * ((b - 1) * totalTexts + t) / totalCalls()));
      await sleep(200);
    }
  }

  if (totalSent > 0) {
    await term.print(
      "[SUCCESS ⬆️] " + totalSent + " e-mails (" + brevoOk + "/" + totalBrevo + " BREVO)",
      "ok"
    );
    setBar(100);
    show("Envoyé : " + totalSent + " e-mails.", "success");
    addHistory(number);
    document.getElementById("number").value = "";
    startCooldown();
  } else {
    await term.print("[ERROR] " + (lastError || "Aucun e-mail envoyé."), "err");
    setBar(100, true);
    show(lastError || "Aucun e-mail envoyé.", "error");
    shake(form);
    btn.disabled    = false;
    btn.textContent = "ENVOYER";
  }
});

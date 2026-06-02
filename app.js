// Seedance Video Generator — frontend only (vanilla JS)
// Kredit disimpan di localStorage. API key juga disimpan lokal (jangan share device).

const LS = {
  credit: "seedance.credit",
  apiKey: "seedance.apiKey",
  endpointPreset: "seedance.endpointPreset",
  endpointCustom: "seedance.endpointCustom",
  pricing: "seedance.pricing",
  history: "seedance.history",
};

const DEFAULT_PRICING = {
  // kredit per detik (estimasi mengikuti tarif Seedance 1.0 Pro: 720p = 15 kr/dtk)
  pro: { "480p": 11, "720p": 15, "1080p": 30 },
  lite: { "480p": 7, "720p": 10, "1080p": 20 },
};

const DEFAULT_CREDIT = 10000;
const MAX_HISTORY = 24;

// ---------- state ----------
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let credit = loadJSON(LS.credit, DEFAULT_CREDIT);
let pricing = loadJSON(LS.pricing, DEFAULT_PRICING);
let history = loadJSON(LS.history, []);

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

const els = {
  creditValue: $("creditValue"),
  editCreditBtn: $("editCreditBtn"),
  creditDialog: $("creditDialog"),
  creditInput: $("creditInput"),
  prompt: $("prompt"),
  promptCount: $("promptCount"),
  model: $("model"),
  resolution: $("resolution"),
  duration: $("duration"),
  ratio: $("ratio"),
  seed: $("seed"),
  camerafixed: $("camerafixed"),
  watermark: $("watermark"),
  costValue: $("costValue"),
  costFormula: $("costFormula"),
  generateBtn: $("generateBtn"),
  demoBtn: $("demoBtn"),
  status: $("status"),
  history: $("history"),
  clearHistoryBtn: $("clearHistoryBtn"),
  apiKey: $("apiKey"),
  endpointPreset: $("endpointPreset"),
  endpointCustom: $("endpointCustom"),
  savePricingBtn: $("savePricingBtn"),
  resetPricingBtn: $("resetPricingBtn"),
};

// ---------- credit ----------
function renderCredit() {
  els.creditValue.textContent = credit.toLocaleString("id-ID");
}
function setCredit(v) {
  credit = Math.max(0, Math.floor(Number(v) || 0));
  saveJSON(LS.credit, credit);
  renderCredit();
}

// ---------- pricing / cost ----------
function modelKey() {
  return els.model.value.includes("lite") ? "lite" : "pro";
}
function pricePerSec() {
  return Number(pricing[modelKey()][els.resolution.value]) || 0;
}
function computeCost() {
  return pricePerSec() * Number(els.duration.value || 0);
}
function renderCost() {
  const cost = computeCost();
  els.costValue.textContent = cost.toLocaleString("id-ID");
  els.costFormula.textContent = `${pricePerSec()} kredit/detik × ${els.duration.value} detik`;
  els.generateBtn.disabled = cost === 0 || cost > credit;
}

function loadPricingInputs() {
  $("price-pro-480").value = pricing.pro["480p"];
  $("price-pro-720").value = pricing.pro["720p"];
  $("price-pro-1080").value = pricing.pro["1080p"];
  $("price-lite-480").value = pricing.lite["480p"];
  $("price-lite-720").value = pricing.lite["720p"];
  $("price-lite-1080").value = pricing.lite["1080p"];
}
function savePricing() {
  pricing = {
    pro: {
      "480p": Number($("price-pro-480").value) || 0,
      "720p": Number($("price-pro-720").value) || 0,
      "1080p": Number($("price-pro-1080").value) || 0,
    },
    lite: {
      "480p": Number($("price-lite-480").value) || 0,
      "720p": Number($("price-lite-720").value) || 0,
      "1080p": Number($("price-lite-1080").value) || 0,
    },
  };
  saveJSON(LS.pricing, pricing);
  renderCost();
  setStatus("Tabel harga tersimpan.", "ok");
}

// ---------- status ----------
let statusTimer = null;
function setStatus(text, kind = "") {
  if (!text) {
    els.status.classList.add("hidden");
    return;
  }
  els.status.className = "status " + kind;
  els.status.textContent = text;
  els.status.classList.remove("hidden");
  if (statusTimer) clearTimeout(statusTimer);
  if (kind === "ok") {
    statusTimer = setTimeout(() => els.status.classList.add("hidden"), 4000);
  }
}

// ---------- history ----------
function renderHistory() {
  if (!history.length) {
    els.history.innerHTML = `<p class="empty">Belum ada hasil. Generate video pertamamu di atas.</p>`;
    return;
  }
  els.history.innerHTML = history
    .map((h, i) => {
      const video = h.videoUrl
        ? `<video controls src="${h.videoUrl}"></video>`
        : `<div class="video-placeholder">${h.status || "tidak ada video"}</div>`;
      const safePrompt = h.prompt.replace(/[<>&]/g, (c) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])
      );
      return `
        <article class="history-item" data-idx="${i}">
          ${video}
          <div class="history-prompt">${safePrompt}</div>
          <div class="history-meta">
            <span>${new Date(h.createdAt).toLocaleString("id-ID")}</span>
            <span class="tags">
              <span class="tag">${h.model.includes("lite") ? "Lite" : "Pro"}</span>
              <span class="tag">${h.resolution}</span>
              <span class="tag">${h.duration}s</span>
              <span class="tag">${h.ratio}</span>
              <span class="tag">−${h.cost} kr</span>
              ${h.demo ? '<span class="tag">DEMO</span>' : ""}
            </span>
          </div>
          <div class="history-actions">
            ${h.videoUrl ? `<a class="btn-ghost" href="${h.videoUrl}" download>Download</a>` : ""}
            <button class="btn-link" data-action="remove" data-idx="${i}">hapus</button>
          </div>
        </article>
      `;
    })
    .join("");
}
function pushHistory(entry) {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  saveJSON(LS.history, history);
  renderHistory();
}

// ---------- endpoint ----------
function currentEndpoint() {
  const preset = els.endpointPreset.value;
  if (preset === "custom") {
    return (els.endpointCustom.value || "").trim();
  }
  return preset;
}

// ---------- BytePlus / Volcengine ARK API ----------
// Doc: POST {endpoint} → creates task → poll GET {endpoint}/{task_id}
async function createTask({ endpoint, apiKey, model, prompt }) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      content: [{ type: "text", text: prompt }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Create task gagal (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

async function pollTask({ endpoint, apiKey, taskId, onTick }) {
  const url = `${endpoint.replace(/\/+$/, "")}/${taskId}`;
  let attempts = 0;
  const maxAttempts = 180; // ~6 menit @ 2s
  while (attempts < maxAttempts) {
    attempts++;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Poll task gagal (${res.status}): ${text || res.statusText}`);
    }
    const data = await res.json();
    const status = data.status || data.task_status;
    if (onTick) onTick(status, attempts, data);
    if (status === "succeeded" || status === "SUCCEEDED" || status === "completed") {
      return data;
    }
    if (status === "failed" || status === "FAILED" || status === "cancelled") {
      const msg = data.error?.message || data.message || "task gagal";
      throw new Error(`Task gagal: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Timeout polling task (>6 menit).");
}

// Coba ambil URL video dari respons (skema bisa berbeda antar versi API)
function extractVideoUrl(data) {
  return (
    data?.content?.video_url ||
    data?.video_url ||
    data?.output?.video_url ||
    data?.data?.video_url ||
    data?.result?.video_url ||
    null
  );
}

// ---------- generate ----------
async function generate({ demo = false } = {}) {
  const prompt = els.prompt.value.trim();
  if (!prompt) {
    setStatus("Prompt tidak boleh kosong.", "error");
    return;
  }
  const cost = computeCost();
  if (cost <= 0) {
    setStatus("Biaya 0 — cek tabel harga.", "error");
    return;
  }
  if (cost > credit) {
    setStatus(`Kredit tidak cukup. Butuh ${cost}, sisa ${credit}.`, "error");
    return;
  }

  const entryBase = {
    prompt,
    model: els.model.value,
    resolution: els.resolution.value,
    duration: Number(els.duration.value),
    ratio: els.ratio.value,
    seed: els.seed.value ? Number(els.seed.value) : null,
    camerafixed: els.camerafixed.checked,
    watermark: els.watermark.checked,
    cost,
    createdAt: Date.now(),
    demo,
  };

  // Bangun text prompt dengan parameter seedance (--rs/--rt/--dur/--seed)
  const flags = [
    `--ratio ${entryBase.ratio}`,
    `--resolution ${entryBase.resolution}`,
    `--duration ${entryBase.duration}`,
    entryBase.camerafixed ? `--camerafixed true` : `--camerafixed false`,
    entryBase.watermark ? `--watermark true` : `--watermark false`,
    entryBase.seed != null ? `--seed ${entryBase.seed}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const fullPrompt = `${prompt} ${flags}`;

  els.generateBtn.disabled = true;
  els.demoBtn.disabled = true;

  try {
    if (demo) {
      setStatus("Demo mode: simulasi generate...", "");
      await new Promise((r) => setTimeout(r, 1200));
      setCredit(credit - cost);
      pushHistory({
        ...entryBase,
        videoUrl: null,
        status: "demo (tidak ada video sungguhan)",
      });
      setStatus(`Demo selesai. −${cost} kredit (saldo ${credit}).`, "ok");
      return;
    }

    const apiKey = (els.apiKey.value || "").trim();
    const endpoint = currentEndpoint();
    if (!apiKey) {
      setStatus("API key kosong. Buka 'Pengaturan API' di bawah.", "error");
      return;
    }
    if (!endpoint) {
      setStatus("Endpoint kosong. Buka 'Pengaturan API' di bawah.", "error");
      return;
    }

    setStatus("Mengirim task ke ARK...", "");
    const createRes = await createTask({
      endpoint,
      apiKey,
      model: entryBase.model,
      prompt: fullPrompt,
    });
    const taskId = createRes.id || createRes.task_id || createRes.data?.id;
    if (!taskId) throw new Error("Respons tidak mengandung task id.");

    setStatus(`Task dibuat (${taskId}). Polling...`, "");
    const final = await pollTask({
      endpoint,
      apiKey,
      taskId,
      onTick: (status, n) => setStatus(`Polling #${n} · status: ${status || "?"}`, ""),
    });
    const videoUrl = extractVideoUrl(final);

    setCredit(credit - cost);
    pushHistory({
      ...entryBase,
      videoUrl,
      status: videoUrl ? "succeeded" : "selesai tanpa URL video",
      taskId,
    });
    setStatus(`Selesai. −${cost} kredit (saldo ${credit}).`, "ok");
  } catch (err) {
    console.error(err);
    setStatus(err.message || String(err), "error");
  } finally {
    els.generateBtn.disabled = false;
    els.demoBtn.disabled = false;
    renderCost();
  }
}

// ---------- event wiring ----------
function wireEvents() {
  // prompt counter
  els.prompt.addEventListener("input", () => {
    els.promptCount.textContent = els.prompt.value.length;
  });

  // cost recompute
  ["change", "input"].forEach((evt) => {
    els.model.addEventListener(evt, renderCost);
    els.resolution.addEventListener(evt, renderCost);
    els.duration.addEventListener(evt, renderCost);
  });

  // credit edit
  els.editCreditBtn.addEventListener("click", () => {
    els.creditInput.value = credit;
    els.creditDialog.showModal();
  });
  els.creditDialog.addEventListener("close", () => {
    if (els.creditDialog.returnValue === "ok") {
      setCredit(els.creditInput.value);
      renderCost();
    }
  });

  // generate
  els.generateBtn.addEventListener("click", () => generate({ demo: false }));
  els.demoBtn.addEventListener("click", () => generate({ demo: true }));

  // clear history
  els.clearHistoryBtn.addEventListener("click", () => {
    if (!history.length) return;
    if (confirm("Hapus seluruh riwayat?")) {
      history = [];
      saveJSON(LS.history, history);
      renderHistory();
    }
  });

  // history item actions
  els.history.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    history.splice(idx, 1);
    saveJSON(LS.history, history);
    renderHistory();
  });

  // api settings persistence
  els.apiKey.addEventListener("change", () => saveJSON(LS.apiKey, els.apiKey.value));
  els.endpointPreset.addEventListener("change", () => {
    saveJSON(LS.endpointPreset, els.endpointPreset.value);
    els.endpointCustom.classList.toggle("hidden", els.endpointPreset.value !== "custom");
  });
  els.endpointCustom.addEventListener("change", () =>
    saveJSON(LS.endpointCustom, els.endpointCustom.value)
  );

  // pricing
  els.savePricingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    savePricing();
  });
  els.resetPricingBtn.addEventListener("click", (e) => {
    e.preventDefault();
    pricing = JSON.parse(JSON.stringify(DEFAULT_PRICING));
    saveJSON(LS.pricing, pricing);
    loadPricingInputs();
    renderCost();
    setStatus("Tabel harga di-reset ke default.", "ok");
  });
}

// ---------- init ----------
function init() {
  // restore saved values
  const savedApiKey = loadJSON(LS.apiKey, "");
  if (savedApiKey) els.apiKey.value = savedApiKey;
  const savedPreset = loadJSON(LS.endpointPreset, null);
  if (savedPreset) els.endpointPreset.value = savedPreset;
  const savedCustom = loadJSON(LS.endpointCustom, "");
  if (savedCustom) els.endpointCustom.value = savedCustom;
  els.endpointCustom.classList.toggle("hidden", els.endpointPreset.value !== "custom");

  loadPricingInputs();
  renderCredit();
  renderCost();
  renderHistory();
  els.promptCount.textContent = els.prompt.value.length;

  wireEvents();
}

init();

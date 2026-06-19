const startBtn = document.getElementById("startBtn");
const topicInput = document.getElementById("topic");
const transcriptEl = document.getElementById("transcript");
const progressEl = document.getElementById("progress");
const phaseLabelEl = document.getElementById("phaseLabel");
const timerBar = document.getElementById("timerBar");
const judgmentEl = document.getElementById("judgment");
const openingFileInput = document.getElementById("openingFile");
const uploadStatusEl = document.getElementById("uploadStatus");

const SIDE_LABEL = { affirmative: "肯定側", negative: "否定側" };

let openingId = null;

openingFileInput.addEventListener("change", async () => {
  const files = Array.from(openingFileInput.files || []);
  if (files.length === 0) return;
  startBtn.disabled = true;
  uploadStatusEl.textContent = `アップロード中…（${files.length}件）`;
  openingId = null;

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  try {
    const res = await fetch("/api/upload-opening", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
    openingId = data.openingId;
    uploadStatusEl.textContent = `読み込み完了（${data.fileCount}件）: ${data.fileNames.join(", ")}`;
    startBtn.disabled = false;
  } catch (err) {
    uploadStatusEl.textContent = `エラー: ${err.message}`;
  }
});

function appendBubble({ side, meta, text }) {
  const div = document.createElement("div");
  div.className = `bubble ${side || ""}`;
  div.innerHTML = `<div class="meta">${meta}</div><div class="body"></div>`;
  div.querySelector(".body").textContent = text;
  transcriptEl.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

function appendBreak(label) {
  const div = document.createElement("div");
  div.className = "break-divider";
  div.textContent = `— ${label} —`;
  transcriptEl.appendChild(div);
}

function animateTimer(seconds) {
  timerBar.style.width = "0%";
  const start = performance.now();
  const durationMs = seconds * 1000;
  function tick() {
    const elapsed = performance.now() - start;
    const pct = Math.min(100, (elapsed / durationMs) * 100);
    timerBar.style.width = pct + "%";
    if (pct < 100) requestAnimationFrame(tick);
  }
  tick();
}

function renderJudgment(j) {
  judgmentEl.classList.remove("hidden");
  if (j.parseError) {
    judgmentEl.innerHTML = `<h2>判定</h2><pre>${j.raw}</pre>`;
    return;
  }
  const rubricLabels = {
    opening: "立論", cross: "反対尋問", rebuttal: "反駁", free: "フリーディスカッション",
    final: "最終弁論", originality: "独創性", teamwork: "チームワーク", overall: "総合力",
  };
  function side(s, label) {
    const rows = Object.entries(s.scores || {})
      .map(([k, v]) => `<div class="score-row"><span>${rubricLabels[k] || k}</span><span>${v}</span></div>`)
      .join("");
    return `<div><h3>${label}（合計 ${s.total} 点）</h3>${rows}<p>${s.comment || ""}</p></div>`;
  }
  judgmentEl.innerHTML = `
    <h2>判定結果</h2>
    <p class="winner">勝者: ${SIDE_LABEL[j.winner] || j.winner}</p>
    <p>${j.summary || ""}</p>
    <div style="display:flex; gap:24px; flex-wrap:wrap;">
      ${side(j.affirmative, "肯定側")}
      ${side(j.negative, "否定側")}
    </div>
  `;
  judgmentEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function startDebate() {
  const topic = topicInput.value.trim();
  if (!topic) {
    alert("論題を入力してください");
    return;
  }
  if (!openingId) {
    alert("肯定側の立論ファイルをアップロードしてください");
    return;
  }
  startBtn.disabled = true;
  transcriptEl.innerHTML = "";
  judgmentEl.classList.add("hidden");
  progressEl.classList.remove("hidden");

  const es = new EventSource(
    `/api/debate/stream?topic=${encodeURIComponent(topic)}&openingId=${encodeURIComponent(openingId)}`
  );

  es.onmessage = (e) => {
    const ev = JSON.parse(e.data);

    if (ev.type === "document") {
      const text = ev.files ? `添付ファイル: ${ev.files.join(", ")}（テキスト抽出せずファイルのまま参照）` : ev.text;
      appendBubble({
        side: ev.side,
        meta: `${ev.phaseLabel} ／ ${SIDE_LABEL[ev.side]}（資料）`,
        text,
      });
    }
    if (ev.type === "phase_start") {
      phaseLabelEl.textContent = ev.label;
    }
    if (ev.type === "break") {
      appendBreak(`${ev.label}（${ev.minutes}分）`);
      animateTimer(ev.seconds);
    }
    if (ev.type === "message") {
      appendBubble({
        side: ev.side,
        meta: `${ev.phaseLabel} ／ ${SIDE_LABEL[ev.side]}（${ev.minutes}分）`,
        text: ev.text,
      });
      animateTimer(ev.seconds);
    }
    if (ev.type === "dialogue") {
      appendBubble({
        side: ev.side,
        meta: `${ev.phaseLabel}（質問: ${SIDE_LABEL[ev.questioner]} → 回答: ${SIDE_LABEL[ev.answerer]}, ${ev.minutes}分）`,
        text: ev.text,
      });
      animateTimer(ev.seconds);
    }
    if (ev.type === "judging_start") {
      phaseLabelEl.textContent = "判定中…";
    }
    if (ev.type === "judgment") {
      renderJudgment(ev);
      phaseLabelEl.textContent = "試合終了";
    }
    if (ev.type === "error") {
      appendBreak(`エラー: ${ev.message}`);
      es.close();
      startBtn.disabled = false;
    }
    if (ev.type === "done") {
      es.close();
      startBtn.disabled = false;
    }
  };

  es.onerror = () => {
    es.close();
    startBtn.disabled = false;
  };
}

startBtn.addEventListener("click", startDebate);
topicInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startDebate();
});

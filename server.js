import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { runDebate } from "./lib/debateEngine.js";
import { saveOpening, getOpening } from "./lib/openingStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.post("/api/upload-opening", upload.array("files", 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    // テキスト抽出は行わず、ファイルをそのまま保存して後続のClaude呼び出しに添付する
    const stored = files.map((f) => ({
      buffer: f.buffer,
      mimetype: f.mimetype,
      originalname: f.originalname,
    }));
    const openingId = saveOpening(stored);
    res.json({ openingId, fileCount: files.length, fileNames: stored.map((f) => f.originalname) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debate/stream", async (req, res) => {
  const topic = (req.query.topic || "").toString().trim();
  const openingId = (req.query.openingId || "").toString().trim();
  if (!topic) {
    res.status(400).json({ error: "topic is required" });
    return;
  }
  const affirmativeFiles = getOpening(openingId);
  if (!affirmativeFiles) {
    res.status(400).json({ error: "立論ファイルが見つかりません。先にアップロードしてください。" });
    return;
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    for await (const event of runDebate({ topic, affirmativeFiles })) {
      send(event);
    }
    send({ type: "done" });
  } catch (err) {
    send({ type: "error", message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Shibusawa Debate App running at http://localhost:${PORT}`);
});

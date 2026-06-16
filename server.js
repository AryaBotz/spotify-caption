import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import cors from "cors";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({ origin: "*" }));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// =========================
// CREATE UPLOADS FOLDER
// =========================
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// =========================
// MULTER CONFIG (FIXED)
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // IMPORTANT: keep extension
    const ext = path.extname(file.originalname);

    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage });

// =========================
// ROOT (UI TEST)
// =========================
app.get("/", (req, res) => {
  res.send(`
    <h2>STT Backend Active</h2>
    <p>POST /api/transcribe</p>
    <p>GET /api/status</p>
  `);
});

// =========================
// STATUS
// =========================
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    time: new Date().toISOString()
  });
});

// =========================
// TRANSCRIBE (MAIN)
// =========================
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded (field must be 'audio')"
      });
    }

    // =========================
    // DEBUG (WAJIB UNTUK CEK ERROR)
    // =========================
    console.log("=== FILE RECEIVED ===");
    console.log("path:", req.file.path);
    console.log("mimetype:", req.file.mimetype);
    console.log("originalname:", req.file.originalname);

    // =========================
    // VALIDATION SIMPLE
    // =========================
    const allowed = [
      "mp3", "wav", "m4a", "ogg",
      "webm", "flac", "opus", "mp4", "mpeg"
    ];

    const ext = path.extname(req.file.originalname).replace(".", "");

    if (!allowed.includes(ext)) {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        error: `Invalid file type: .${ext}`
      });
    }

    // =========================
    // GROQ WHISPER
    // =========================
    const result = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3"
    });

    // cleanup
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      text: result.text
    });

  } catch (err) {
    console.error("ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});

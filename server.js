import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.static("public"));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// =======================
// MULTER CONFIG
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// =======================
// BASIC STATUS
// =======================
app.get("/api/status", (req, res) => {
  res.json({ status: "online" });
});

// =======================
// SINGLE TRANSCRIBE
// =======================
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio uploaded" });
    }

    console.log("FILE INFO:");
    console.log(req.file);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3"
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      text: transcription.text
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =======================
// STREAM SIMULATE (CHUNKING)
// =======================
app.post("/api/stream-simulate", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio uploaded" });
    }

    const inputPath = req.file.path;
    const chunkDir = "chunks_" + Date.now();

    fs.mkdirSync(chunkDir);

    // split audio into 5-second chunks
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          "-f segment",
          "-segment_time 5",
          "-c copy"
        ])
        .output(`${chunkDir}/chunk_%03d.mp3`)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    const files = fs.readdirSync(chunkDir).sort();

    let results = [];

    for (const file of files) {
      const chunkPath = `${chunkDir}/${file}`;

      console.log("Processing chunk:", file);

      try {
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(chunkPath),
          model: "whisper-large-v3"
        });

        results.push({
          chunk: file,
          text: transcription.text
        });

      } catch (err) {
        results.push({
          chunk: file,
          error: err.message
        });
      }

      // simulate realtime delay
      await new Promise(r => setTimeout(r, 500));
    }

    // cleanup
    fs.unlinkSync(inputPath);
    fs.rmSync(chunkDir, { recursive: true, force: true });

    res.json({
      success: true,
      chunks: results
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

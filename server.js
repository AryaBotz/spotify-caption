import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(express.static("public"));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const upload = multer({
  dest: "uploads/"
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "online"
  });
});

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No audio uploaded"
      });
    }

    const transcription =
      await groq.audio.transcriptions.create({
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});

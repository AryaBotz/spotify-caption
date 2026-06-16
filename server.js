import express from "express";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: "*"
}));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ensure uploads folder
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const upload = multer({
  dest: "uploads/"
});

// status test
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    time: new Date().toISOString()
  });
});

// transcription endpoint
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "field harus: audio"
      });
    }

    const result = await groq.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "whisper-large-v3"
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      text: result.text
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>STT Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial; max-width: 600px; margin: 40px auto;">

  <h2>🎙 STT Dashboard</h2>

  <input type="file" id="audio" accept="audio/*" />
  <button onclick="upload()">Transcribe</button>

  <p id="status"></p>
  <pre id="result" style="white-space: pre-wrap;"></pre>

  <script>
    async function upload() {
      const file = document.getElementById("audio").files[0];
      if (!file) {
        alert("Pilih file dulu");
        return;
      }

      const status = document.getElementById("status");
      const result = document.getElementById("result");

      status.innerText = "Uploading...";

      const formData = new FormData();
      formData.append("audio", file);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData
        });

        const data = await res.json();

        if (data.success) {
          status.innerText = "Done";
          result.innerText = data.text;
        } else {
          status.innerText = "Error";
          result.innerText = data.error;
        }

      } catch (err) {
        status.innerText = "Request failed";
        result.innerText = err.message;
      }
    }
  </script>

</body>
</html>
  `);
});

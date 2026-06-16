const API_URL = "https://spotify-caption-production.up.railway.app";

async function upload() {
  const fileInput = document.getElementById("audio");
  const file = fileInput.files[0];

  if (!file) {
    alert("Pilih file audio dulu");
    return;
  }

  const status = document.getElementById("status");
  const result = document.getElementById("result");

  status.innerText = "Uploading...";

  const formData = new FormData();
  formData.append("audio", file);

  try {
    const res = await fetch(`${API_URL}/api/transcribe`, {
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

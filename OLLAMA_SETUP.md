# Ollama Setup Guide

The **Startup Problem Marketplace** requires Ollama to function. Ollama provides local AI inference using Llama 3, which analyzes news articles to identify business problems.

## Step-by-Step Setup

### Step 1: Download & Install Ollama
1. Go to **https://ollama.ai**
2. Click "Download"
3. Choose your OS (Windows/Mac/Linux)
4. Run the installer and follow prompts
5. Accept default settings (listens on `http://localhost:11434`)

### Step 2: Pull the Llama 3 Model
Open **PowerShell** or **Terminal** and run:
```powershell
ollama pull llama3:8b
```

**What happens:**
- Downloads the Llama 3 8B model (~4.7GB)
- First time takes 5-15 minutes depending on internet speed
- Subsequent runs use the cached version

**Expected output:**
```
pulling manifest
pulling 3d0f7d34f1b9...
verifying sha256 digest
writing manifest
success
```

### Step 3: Start Ollama Server
In the same terminal, run:
```powershell
ollama serve
```

**Expected output:**
```
Listening on http://127.0.0.1:11434
```

✅ **Keep this terminal open!** The backend needs Ollama running whenever you use the app.

---

## Verify It's Working

Test the connection with PowerShell:
```powershell
curl -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d '{"model":"llama3:8b","prompt":"Hello","stream":false}'
```

You should get a JSON response with text from Llama 3.

---

## Running the App

Now that Ollama is ready:

**Terminal 1 (Keep Ollama running):**
```powershell
ollama serve
```

**Terminal 2 (Backend):**
```powershell
cd "d:\HTF'"
python -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1
```

**Terminal 3 (Frontend):**
```powershell
cd "d:\HTF'\frontend"
npm run dev
```

**Open browser:**
```
http://localhost:5173
```

Click **"Fetch Latest News"** and watch the magic happen! ✨

---

## Troubleshooting

### "504 Gateway Timeout" or "Connection refused"
- Ollama server is not running
- **Solution:** Run `ollama serve` in a terminal

### "Model not found"
- Llama 3 wasn't pulled
- **Solution:** Run `ollama pull llama3:8b` and wait for completion

### "Port already in use"
- Another app is using port 11434
- **Solution:** Check Task Manager → kill the process, or change Ollama settings

### Slow article processing
- First Ollama inference is slower as it loads the model into memory
- **Normal:** Takes 15-30 seconds per article on first run
- Subsequent articles are faster (~5-10 seconds)

---

## Model Performance on Different Hardware

| Hardware | Llama 3 8B Speed | Notes |
|----------|-----------------|-------|
| RTX 4090 | ~5 sec/article | Fast |
| RTX 3080 | ~8 sec/article | Good |
| RTX 3060 | ~12 sec/article | Acceptable |
| CPU only | ~60+ sec/article | Very slow, consider reducing `MAX_ARTICLES_PER_FETCH` in `config.py` |

---

## Reduce Processing Time

If you have a slower computer, edit `backend/config.py`:
```python
MAX_ARTICLES_PER_FETCH: int = 5   # Reduced from 25
MAX_PROBLEMS_TO_GENERATE: int = 2  # Reduced from 5
```

This fetches fewer articles but processes faster.

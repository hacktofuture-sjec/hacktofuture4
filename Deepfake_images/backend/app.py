from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil
import os
from dotenv import load_dotenv

# Load .env at application startup
load_dotenv()

from agents.detection_agent import DetectionAgent
from agents.forensic_agent import ForensicAgent
from agents.metadata_agent import MetadataAgent
from agents.reasoning_agent import ReasoningAgent

# Use absolute backend import depending on execution dir. 
# Trying a safe try/except fallback
try:
    from backend.llm_agent import LLMReasoningAgent
except ImportError:
    from llm_agent import LLMReasoningAgent

app = FastAPI()

# Add CORS Middleware to allow frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = DetectionAgent()
forensic = ForensicAgent()
metadata = MetadataAgent()
reasoner = ReasoningAgent()
llm_reasoner = LLMReasoningAgent()

class ExplainRequest(BaseModel):
    results: dict

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):

    file_path = f"temp_{file.filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    det = detector.analyze(file_path)
    foren = forensic.analyze(file_path)
    meta = metadata.analyze(file_path)

    final = reasoner.analyze(det, foren, meta)

    os.remove(file_path)

    return {
        "detection": det,
        "forensic": foren,
        "metadata": meta,
        "final": final
    }

@app.post("/explain")
async def explain(request: ExplainRequest):
    # Get natural language representation of reasoning 
    explanation = llm_reasoner.explain(request.results)
    return {"llm_explanation": explanation}
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from pathlib import Path
from typing import Optional

app = FastAPI(
    title="GenAI Bias API",
    description="Backend API for GenAI Bias profile data analysis",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILES_DIR = Path(__file__).parent.parent / "profiles"
MODELS = ['deepseek', 'gemini', 'mistral', 'openai']

DIFF_FILES = {
    'deepseek': PROFILES_DIR / 'deepseek_differences_vs_bls.csv',
    'gemini':   PROFILES_DIR / 'gemini_differences_vs_bls.csv',
    'mistral':  PROFILES_DIR / 'mistral_differences_vs_bls.csv',
    'openai':   PROFILES_DIR / 'openai_differences_vs_bls.csv',
}


def read_csv(file_path: Path) -> Optional[pd.DataFrame]:
    try:
        if not file_path.exists():
            return None
        return pd.read_csv(file_path)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None


def load_all_diffs() -> Optional[pd.DataFrame]:
    """Load and concatenate all model difference CSVs into one DataFrame."""
    frames = []
    for model, path in DIFF_FILES.items():
        df = read_csv(path)
        if df is not None:
            df['model_name'] = model  # ensure model column is present
            frames.append(df)
    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "GenAI Bias API is running"}


@app.get("/api/models")
async def get_models():
    return {"success": True, "data": MODELS}


@app.get("/api/occupations")
async def get_occupations():
    """Return distinct occupation names from the diff files."""
    df = load_all_diffs()
    if df is None:
        raise HTTPException(status_code=500, detail="Failed to load difference data")
    occupations = sorted(df['occupation'].dropna().unique().tolist())
    return {"success": True, "data": occupations}


@app.get("/api/differences")
async def get_all_differences():
    """Return all rows from all model difference CSVs."""
    df = load_all_diffs()
    if df is None:
        raise HTTPException(status_code=500, detail="Failed to load difference data")
    df = df.where(pd.notnull(df), None)
    return {"success": True, "data": df.to_dict(orient='records')}


@app.get("/api/differences/{occupation}")
async def get_differences_by_occupation(occupation: str):
    """Return difference rows for a specific occupation across all models."""
    df = load_all_diffs()
    if df is None:
        raise HTTPException(status_code=500, detail="Failed to load difference data")
    filtered = df[df['occupation'].str.lower() == occupation.lower()]
    if filtered.empty:
        raise HTTPException(status_code=404, detail=f"Occupation not found: {occupation}")
    filtered = filtered.where(pd.notnull(filtered), None)
    return {"success": True, "data": filtered.to_dict(orient='records')}


@app.get("/api/differences/{model}/{occupation}")
async def get_differences_by_model_and_occupation(model: str, occupation: str):
    """Return difference row for a specific model and occupation."""
    if model not in MODELS:
        raise HTTPException(status_code=400, detail=f"Invalid model. Choose from: {', '.join(MODELS)}")
    df = read_csv(DIFF_FILES[model])
    if df is None:
        raise HTTPException(status_code=500, detail=f"Failed to load data for model: {model}")
    filtered = df[df['occupation'].str.lower() == occupation.lower()]
    if filtered.empty:
        raise HTTPException(status_code=404, detail=f"Occupation not found: {occupation}")
    filtered = filtered.where(pd.notnull(filtered), None)
    return {"success": True, "data": filtered.to_dict(orient='records')[0], "model": model}


@app.get("/")
async def root():
    return {
        "message": "GenAI Bias API v2",
        "docs": "/docs",
        "endpoints": [
            "GET /api/health",
            "GET /api/models",
            "GET /api/occupations",
            "GET /api/differences",
            "GET /api/differences/{occupation}",
            "GET /api/differences/{model}/{occupation}",
        ]
    }

@app.get("/api/debug")
async def debug():
    import os
    return {
        "cwd": os.getcwd(),
        "server_file": str(Path(__file__)),
        "profiles_dir": str(PROFILES_DIR),
        "profiles_exists": PROFILES_DIR.exists(),
        "profiles_contents": os.listdir(PROFILES_DIR) if PROFILES_DIR.exists() else "NOT FOUND"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=3000, reload=True)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os
from pathlib import Path
from typing import Dict, List, Optional, Any

app = FastAPI(
    title="GenAI Bias API",
    description="Backend API for GenAI Bias profile data analysis",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directory paths
PROFILES_DIR = Path(__file__).parent.parent / "profiles"
MODELS = ['deepseek', 'gemini', 'mistral', 'openai']


# Helper function to read CSV file
def read_csv(file_path: Path) -> Optional[pd.DataFrame]:
    """Read and parse CSV file, return DataFrame or None on error."""
    try:
        if not file_path.exists():
            return None
        df = pd.read_csv(file_path)
        return df
    except Exception as e:
        print(f"Error reading CSV file {file_path}: {e}")
        return None


# API Routes

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "GenAI Bias API is running"
    }


@app.get("/api/baselines")
async def get_baselines():
    """Get baseline data for all occupations from BLS."""
    baseline_path = PROFILES_DIR / "bls-baselines.csv"
    df = read_csv(baseline_path)
    
    if df is not None:
        return {
            "success": True,
            "data": df.to_dict(orient='records')
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to read baseline data"
        )


@app.get("/api/baselines/{occupation}")
async def get_baseline_by_occupation(occupation: str):
    """Get baseline data for a specific occupation."""
    baseline_path = PROFILES_DIR / "bls-baselines.csv"
    df = read_csv(baseline_path)
    
    if df is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to read baseline data"
        )
    
    # Filter by occupation (case-insensitive)
    occupation_data = df[
        df['genai_bias_search_term'].str.lower() == occupation.lower()
    ]
    
    if not occupation_data.empty:
        return {
            "success": True,
            "data": occupation_data.to_dict(orient='records')[0]
        }
    else:
        raise HTTPException(
            status_code=404,
            detail="Occupation not found"
        )


@app.get("/api/occupations")
async def get_occupations():
    """Get list of all available occupations."""
    baseline_path = PROFILES_DIR / "bls-baselines.csv"
    df = read_csv(baseline_path)
    
    if df is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to read occupation data"
        )
    
    occupations = []
    for _, row in df.iterrows():
        occupations.append({
            "name": row['Occupation'],
            "searchTerm": row['genai_bias_search_term'],
            "nEmployed": row['n_employed'],
            "pWomen": row['p_women'],
            "dataGenerated": row['data generated?']
        })
    
    return {
        "success": True,
        "data": occupations
    }


@app.get("/api/models")
async def get_models():
    """Get list of available AI models."""
    return {
        "success": True,
        "data": MODELS
    }


@app.get("/api/profiles/{model}/{occupation}")
async def get_profiles_by_model_and_occupation(model: str, occupation: str):
    """Get profiles for a specific occupation and model."""
    if model not in MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model. Available models: {', '.join(MODELS)}"
        )
    
    # Try different file naming patterns
    possible_filenames = [
        f"{occupation}_{model}.csv",  # deepseek, gemini pattern
        f"{occupation}profiles_{model}.csv",  # openai pattern
        f"{occupation}profile_{model}.csv",  # mistral pattern
    ]
    
    df = None
    for filename in possible_filenames:
        profile_path = PROFILES_DIR / model / filename
        df = read_csv(profile_path)
        if df is not None:
            break
    
    if df is not None:
        # Replace NaN with None for JSON serialization
        df = df.where(pd.notnull(df), None)
        return {
            "success": True,
            "data": df.to_dict(orient='records'),
            "model": model,
            "occupation": occupation,
            "count": len(df)
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Profile not found for occupation: {occupation} in model: {model}"
        )


@app.get("/api/profiles/{occupation}")
async def get_profiles_by_occupation(occupation: str):
    """Get profiles for a specific occupation across all models."""
    all_profiles = {}
    found_any = False
    
    for model in MODELS:
        # Try different file naming patterns
        possible_filenames = [
            f"{occupation}_{model}.csv",  # deepseek, gemini pattern
            f"{occupation}profiles_{model}.csv",  # openai pattern
            f"{occupation}profile_{model}.csv",  # mistral pattern
        ]
        
        df = None
        for filename in possible_filenames:
            profile_path = PROFILES_DIR / model / filename
            df = read_csv(profile_path)
            if df is not None:
                break
        
        if df is not None:
            # Replace NaN with None for JSON serialization
            df = df.where(pd.notnull(df), None)
            all_profiles[model] = df.to_dict(orient='records')
            found_any = True
    
    if found_any:
        return {
            "success": True,
            "data": all_profiles,
            "occupation": occupation
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No profiles found for occupation: {occupation}"
        )


@app.get("/api/statistics/{occupation}")
async def get_statistics(occupation: str):
    """Get statistical analysis for a specific occupation across all models."""
    statistics = {}
    
    for model in MODELS:
        # Try different file naming patterns
        possible_filenames = [
            f"{occupation}_{model}.csv",  # deepseek, gemini pattern
            f"{occupation}profiles_{model}.csv",  # openai pattern
            f"{occupation}profile_{model}.csv",  # mistral pattern
        ]
        
        df = None
        for filename in possible_filenames:
            profile_path = PROFILES_DIR / model / filename
            df = read_csv(profile_path)
            if df is not None:
                break
        
        if df is not None:
            # Calculate statistics
            gender_stats = df['gender'].value_counts().to_dict() if 'gender' in df.columns else {}
            ethnicity_stats = df['ethnicity'].value_counts().to_dict() if 'ethnicity' in df.columns else {}
            
            # Salary statistics
            salary_stats = {
                "average": 0,
                "min": 0,
                "max": 0
            }
            
            if 'salary' in df.columns:
                salaries = pd.to_numeric(df['salary'], errors='coerce').dropna()
                if len(salaries) > 0:
                    salary_stats = {
                        "average": float(salaries.mean()),
                        "min": float(salaries.min()),
                        "max": float(salaries.max())
                    }
            
            statistics[model] = {
                "totalProfiles": len(df),
                "genderDistribution": gender_stats,
                "ethnicityDistribution": ethnicity_stats,
                "salaryStats": salary_stats
            }
    
    if statistics:
        return {
            "success": True,
            "data": statistics,
            "occupation": occupation
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"No statistics available for occupation: {occupation}"
        )


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "GenAI Bias API",
        "version": "1.0.0",
        "docs": "/docs",
        "availableEndpoints": [
            "GET /api/health",
            "GET /api/baselines",
            "GET /api/baselines/{occupation}",
            "GET /api/occupations",
            "GET /api/models",
            "GET /api/profiles/{occupation}",
            "GET /api/profiles/{model}/{occupation}",
            "GET /api/statistics/{occupation}"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=3000,
        reload=True,
        log_level="info"
    )

# GenAI Bias Backend API

A REST API for serving AI-generated profile data and analyzing bias across different language models.

Built with Python FastAPI for high performance and automatic API documentation.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the server:
```bash
python server.py
```

Or using uvicorn directly:
```bash
uvicorn server:app --host 0.0.0.0 --port 3000 --reload
```

The server will run on `http://localhost:3000` by default.

## Interactive API Documentation

FastAPI provides automatic interactive API documentation:
- **Swagger UI**: http://localhost:3000/docs
- **ReDoc**: http://localhost:3000/redoc

## API Endpoints

### Health Check
- **GET** `/api/health`
  - Returns server status

### Baseline Data
- **GET** `/api/baselines`
  - Returns all BLS baseline occupation statistics
  
- **GET** `/api/baselines/:occupation`
  - Returns baseline data for a specific occupation
  - Example: `/api/baselines/doctor`

### Occupations
- **GET** `/api/occupations`
  - Returns list of all available occupations with basic info

### Models
- **GET** `/api/models`
  - Returns list of available AI models (deepseek, gemini, mistral, openai)

### Profiles
- **GET** `/api/profiles/:occupation`
  - Returns all generated profiles for an occupation across all models
  - Example: `/api/profiles/doctor`
  
- **GET** `/api/profiles/:model/:occupation`
  - Returns generated profiles for a specific occupation and model
  - Example: `/api/profiles/openai/doctor`

### Statistics
- **GET** `/api/statistics/:occupation`
  - Returns statistical analysis of profiles for an occupation
  - Includes gender distribution, ethnicity distribution, and salary statistics
  - Example: `/api/statistics/doctor`

## Response Format

All endpoints return JSON in the following format:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

## Example Usage

### Get all occupations
```bash
curl http://localhost:3000/api/occupations
```

### Get doctor profiles from OpenAI
```bash
curl http://localhost:3000/api/profiles/openai/doctor
```

### Get statistics for nurses
```bash
curl http://localhost:3000/api/statistics/nurse
```

### Get baseline data for engineers
```bash
curl http://localhost:3000/api/baselines/engineer
```

## CORS

CORS is enabled for all origins, making it easy to integrate with any frontend application.

## Project Structure

```
backend/
├── server.py          # Main FastAPI server
├── requirements.txt   # Python dependencies
└── README.md          # This file

profiles/              # Data directory (parent folder)
├── bls-baselines.csv
├── deepseek/
├── gemini/
├── mistral/
└── openai/
```

## Features

- ✅ **High Performance**: Built with FastAPI, one of the fastest Python frameworks
- ✅ **Auto Documentation**: Interactive API docs with Swagger UI and ReDoc
- ✅ **Type Safety**: Full type hints and validation with Pydantic
- ✅ **Data Processing**: Uses pandas for efficient CSV parsing and statistics
- ✅ **CORS Enabled**: Ready for frontend integration
- ✅ **Error Handling**: Comprehensive error validation and responses

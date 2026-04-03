const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Data directory paths
const PROFILES_DIR = path.join(__dirname, '../profiles');
const MODELS = ['deepseek', 'gemini', 'mistral', 'openai'];

// Helper function to read and parse CSV file
function readCSV(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    return records;
  } catch (error) {
    console.error(`Error reading CSV file ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to get all occupation files in a model directory
function getOccupationFiles(model) {
  const modelDir = path.join(PROFILES_DIR, model);
  if (!fs.existsSync(modelDir)) return [];
  
  return fs.readdirSync(modelDir)
    .filter(file => file.endsWith('.csv'))
    .map(file => file.replace(`.csv`, '').replace(`_${model}`, ''));
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GenAI Bias API is running' });
});

// Get baseline data for all occupations
app.get('/api/baselines', (req, res) => {
  const baselinePath = path.join(PROFILES_DIR, 'bls-baselines.csv');
  const data = readCSV(baselinePath);
  
  if (data) {
    res.json({ success: true, data });
  } else {
    res.status(500).json({ success: false, error: 'Failed to read baseline data' });
  }
});

// Get baseline data for a specific occupation
app.get('/api/baselines/:occupation', (req, res) => {
  const { occupation } = req.params;
  const baselinePath = path.join(PROFILES_DIR, 'bls-baselines.csv');
  const data = readCSV(baselinePath);
  
  if (data) {
    const occupationData = data.find(row => 
      row.genai_bias_search_term.toLowerCase() === occupation.toLowerCase()
    );
    
    if (occupationData) {
      res.json({ success: true, data: occupationData });
    } else {
      res.status(404).json({ success: false, error: 'Occupation not found' });
    }
  } else {
    res.status(500).json({ success: false, error: 'Failed to read baseline data' });
  }
});

// Get list of all available occupations
app.get('/api/occupations', (req, res) => {
  const baselinePath = path.join(PROFILES_DIR, 'bls-baselines.csv');
  const data = readCSV(baselinePath);
  
  if (data) {
    const occupations = data.map(row => ({
      name: row.Occupation,
      searchTerm: row.genai_bias_search_term,
      nEmployed: row.n_employed,
      pWomen: row.p_women,
      dataGenerated: row['data generated?']
    }));
    
    res.json({ success: true, data: occupations });
  } else {
    res.status(500).json({ success: false, error: 'Failed to read occupation data' });
  }
});

// Get profiles for a specific occupation and model
app.get('/api/profiles/:model/:occupation', (req, res) => {
  const { model, occupation } = req.params;
  
  if (!MODELS.includes(model)) {
    return res.status(400).json({ 
      success: false, 
      error: `Invalid model. Available models: ${MODELS.join(', ')}` 
    });
  }
  
  const profilePath = path.join(PROFILES_DIR, model, `${occupation}_${model}.csv`);
  const data = readCSV(profilePath);
  
  if (data) {
    res.json({ 
      success: true, 
      data,
      model,
      occupation,
      count: data.length
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: `Profile not found for occupation: ${occupation} in model: ${model}` 
    });
  }
});

// Get profiles for a specific occupation across all models
app.get('/api/profiles/:occupation', (req, res) => {
  const { occupation } = req.params;
  const allProfiles = {};
  let foundAny = false;
  
  MODELS.forEach(model => {
    const profilePath = path.join(PROFILES_DIR, model, `${occupation}_${model}.csv`);
    const data = readCSV(profilePath);
    
    if (data) {
      allProfiles[model] = data;
      foundAny = true;
    }
  });
  
  if (foundAny) {
    res.json({ 
      success: true, 
      data: allProfiles,
      occupation
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: `No profiles found for occupation: ${occupation}` 
    });
  }
});

// Get list of available models
app.get('/api/models', (req, res) => {
  res.json({ 
    success: true, 
    data: MODELS 
  });
});

// Get statistics for a specific occupation across all models
app.get('/api/statistics/:occupation', (req, res) => {
  const { occupation } = req.params;
  const statistics = {};
  
  MODELS.forEach(model => {
    const profilePath = path.join(PROFILES_DIR, model, `${occupation}_${model}.csv`);
    const data = readCSV(profilePath);
    
    if (data) {
      // Calculate statistics
      const genderStats = {};
      const ethnicityStats = {};
      const salaries = [];
      
      data.forEach(profile => {
        // Gender distribution
        if (profile.gender) {
          genderStats[profile.gender] = (genderStats[profile.gender] || 0) + 1;
        }
        
        // Ethnicity distribution
        if (profile.ethnicity) {
          ethnicityStats[profile.ethnicity] = (ethnicityStats[profile.ethnicity] || 0) + 1;
        }
        
        // Salary data
        if (profile.salary) {
          salaries.push(parseFloat(profile.salary));
        }
      });
      
      // Calculate salary statistics
      const avgSalary = salaries.length > 0 
        ? salaries.reduce((a, b) => a + b, 0) / salaries.length 
        : 0;
      const minSalary = salaries.length > 0 ? Math.min(...salaries) : 0;
      const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 0;
      
      statistics[model] = {
        totalProfiles: data.length,
        genderDistribution: genderStats,
        ethnicityDistribution: ethnicityStats,
        salaryStats: {
          average: avgSalary,
          min: minSalary,
          max: maxSalary
        }
      };
    }
  });
  
  if (Object.keys(statistics).length > 0) {
    res.json({ 
      success: true, 
      data: statistics,
      occupation
    });
  } else {
    res.status(404).json({ 
      success: false, 
      error: `No statistics available for occupation: ${occupation}` 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/baselines',
      'GET /api/baselines/:occupation',
      'GET /api/occupations',
      'GET /api/models',
      'GET /api/profiles/:occupation',
      'GET /api/profiles/:model/:occupation',
      'GET /api/statistics/:occupation'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GenAI Bias API server running on http://localhost:${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   - GET /api/health`);
  console.log(`   - GET /api/baselines`);
  console.log(`   - GET /api/baselines/:occupation`);
  console.log(`   - GET /api/occupations`);
  console.log(`   - GET /api/models`);
  console.log(`   - GET /api/profiles/:occupation`);
  console.log(`   - GET /api/profiles/:model/:occupation`);
  console.log(`   - GET /api/statistics/:occupation`);
});

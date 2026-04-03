// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// State management
let currentOccupation = null;
let currentModel = 'all';
let occupations = [];
let baselineData = null;
let profilesData = {};
let statisticsData = {};

// Model configurations
const modelConfig = {
    openai: { icon: '💬', color: '#10a37f', name: 'ChatGPT' },
    gemini: { icon: '◆', color: '#8e44ad', name: 'Gemini' },
    deepseek: { icon: '🔍', color: '#3498db', name: 'DeepSeek' },
    mistral: { icon: 'Ⓜ', color: '#d97706', name: 'Mistral' }
};

// Initialize the application
async function init() {
    setupEventListeners();
    await loadOccupations();
}

// Setup event listeners
function setupEventListeners() {
    // Model buttons
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentModel = e.currentTarget.dataset.model;
            if (currentOccupation) {
                updateDisplay();
            }
        });
    });
}

// API Functions
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// Load occupations list
async function loadOccupations() {
    const result = await fetchAPI('/occupations');
    
    if (result && result.success) {
        occupations = result.data;
        renderOccupationList();
    }
}

// Render occupation list in sidebar
function renderOccupationList() {
    const container = document.getElementById('occupationList');
    container.innerHTML = '';
    
    occupations.forEach(occupation => {
        const btn = document.createElement('button');
        btn.className = 'occupation-btn';
        btn.textContent = occupation.name;
        btn.dataset.searchTerm = occupation.searchTerm;
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.occupation-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadOccupationData(occupation.searchTerm, occupation.name);
        });
        
        container.appendChild(btn);
    });
}

// Load data for selected occupation
async function loadOccupationData(searchTerm, occupationName) {
    currentOccupation = searchTerm;
    
    // Show loading state
    document.getElementById('occupationTitle').textContent = occupationName;
    document.getElementById('modelInfo').textContent = 'Loading data...';
    document.getElementById('modelInfo').className = 'model-info neutral';
    document.getElementById('chartContainer').innerHTML = '<div class="loading">Loading charts...</div>';
    
    // Fetch baseline data
    const baseline = await fetchAPI(`/baselines/${searchTerm}`);
    if (baseline && baseline.success) {
        baselineData = baseline.data;
    }
    
    // Fetch profiles
    const profiles = await fetchAPI(`/profiles/${searchTerm}`);
    if (profiles && profiles.success) {
        profilesData = profiles.data;
    }
    
    // Fetch statistics
    const stats = await fetchAPI(`/statistics/${searchTerm}`);
    if (stats && stats.success) {
        statisticsData = stats.data;
    }
    
    updateDisplay();
}

// Update the display with current data
function updateDisplay() {
    if (!currentOccupation || !statisticsData || !baselineData) return;
    
    updateModelInfo();
    updateCharts();
}

// Update model info text
function updateModelInfo() {
    const modelInfo = document.getElementById('modelInfo');
    
    if (currentModel === 'all') {
        modelInfo.textContent = 'All LLMs performed similarly against the baseline.';
        modelInfo.className = 'model-info neutral';
    } else {
        const modelStats = statisticsData[currentModel];
        if (modelStats) {
            const modelName = modelConfig[currentModel].name;
            
            // Check for extreme representation
            const biasInfo = findExtremeBias(modelStats);
            if (biasInfo) {
                modelInfo.textContent = `${modelName} ${biasInfo.type} ${biasInfo.demographic} by ${Math.abs(biasInfo.deviation).toFixed(0)}% in the occupation, ${document.getElementById('occupationTitle').textContent}.`;
                modelInfo.className = 'model-info';
            } else {
                modelInfo.textContent = `${modelName} results for ${document.getElementById('occupationTitle').textContent}.`;
                modelInfo.className = 'model-info neutral';
            }
        }
    }
}

// Find extreme bias in model
function findExtremeBias(modelStats) {
    if (!baselineData) return null;
    
    const demographics = [
        { key: 'gender', value: 'Female', baselineKey: 'p_women' },
        { key: 'ethnicity', value: 'White', baselineKey: 'p_white' },
        { key: 'ethnicity', value: 'Hispanic', baselineKey: 'p_hispanic' },
        { key: 'ethnicity', value: 'Black', baselineKey: 'p_black' },
        { key: 'ethnicity', value: 'Asian', baselineKey: 'p_asian' }
    ];
    
    let maxDeviation = null;
    
    demographics.forEach(demo => {
        const dist = demo.key === 'gender' ? modelStats.genderDistribution : modelStats.ethnicityDistribution;
        if (dist) {
            // If the demographic doesn't exist in the distribution, treat it as 0%
            const count = dist[demo.value] || 0;
            const modelPercent = (count / modelStats.totalProfiles) * 100;
            const baselinePercent = parseFloat(baselineData[demo.baselineKey]);
            const deviation = modelPercent - baselinePercent;
            
            if (Math.abs(deviation) >= 80 || (maxDeviation === null && Math.abs(deviation) > 30)) {
                if (maxDeviation === null || Math.abs(deviation) > Math.abs(maxDeviation.deviation)) {
                    maxDeviation = {
                        demographic: demo.value === 'Female' ? 'Women' : demo.value,
                        deviation: deviation,
                        type: deviation > 0 ? 'overrepresented' : 'underrepresented'
                    };
                }
            }
        }
    });
    
    return maxDeviation;
}

// Update charts with demographic data
function updateCharts() {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';
    
    if (!baselineData) return;
    
    const demographics = [
        { label: 'Women', key: 'gender', value: 'Female', baselineKey: 'p_women' },
        { label: 'White', key: 'ethnicity', value: 'White', baselineKey: 'p_white' },
        { label: 'Hispanic', key: 'ethnicity', value: 'Hispanic', baselineKey: 'p_hispanic' },
        { label: 'Black', key: 'ethnicity', value: 'Black', baselineKey: 'p_black' },
        { label: 'Asian', key: 'ethnicity', value: 'Asian', baselineKey: 'p_asian' }
    ];
    
    demographics.forEach(demo => {
        createChartRow(container, demo);
    });
    
    // Add axis labels
    const axis = document.createElement('div');
    axis.className = 'chart-axis';
    axis.innerHTML = `
        <span class="axis-label left">-100%</span>
        <span class="axis-label center">0<br><span class="baseline-label">National Statistics Baseline</span></span>
        <span class="axis-label right">+100%</span>
    `;
    container.appendChild(axis);
}

// Create a chart row for a demographic
function createChartRow(container, demo) {
    const row = document.createElement('div');
    row.className = 'chart-row';
    
    const label = document.createElement('div');
    label.className = 'chart-label';
    label.textContent = demo.label;
    
    const track = document.createElement('div');
    track.className = 'chart-track';
    
    const baseline = document.createElement('div');
    baseline.className = 'chart-baseline';
    track.appendChild(baseline);
    
    const iconsContainer = document.createElement('div');
    iconsContainer.className = 'chart-icons';
    
    // Calculate deviations and place icons
    if (currentModel === 'all') {
        // Show all models
        Object.entries(modelConfig).forEach(([modelKey, config]) => {
            if (statisticsData[modelKey]) {
                const deviation = calculateDeviation(modelKey, demo);
                if (deviation !== null) {
                    placeIcon(iconsContainer, deviation, config);
                }
            }
        });
    } else {
        // Show single model
        if (statisticsData[currentModel]) {
            const deviation = calculateDeviation(currentModel, demo);
            if (deviation !== null) {
                placeIcon(iconsContainer, deviation, modelConfig[currentModel]);
            }
        }
    }
    
    track.appendChild(iconsContainer);
    row.appendChild(label);
    row.appendChild(track);
    container.appendChild(row);
}

// Calculate deviation from baseline
function calculateDeviation(modelKey, demo) {
    const modelStats = statisticsData[modelKey];
    if (!modelStats || !baselineData) return null;
    
    const dist = demo.key === 'gender' ? modelStats.genderDistribution : modelStats.ethnicityDistribution;
    if (!dist) return null;
    
    // If the demographic doesn't exist in the distribution, treat it as 0%
    const count = dist[demo.value] || 0;
    const modelPercent = (count / modelStats.totalProfiles) * 100;
    const baselinePercent = parseFloat(baselineData[demo.baselineKey]);
    
    return modelPercent - baselinePercent;
}

// Place icon on chart track
function placeIcon(container, deviation, config) {
    const icon = document.createElement('div');
    icon.className = 'icon-marker';
    icon.textContent = config.icon;
    icon.style.color = config.color;
    
    // Convert deviation (-100 to +100) to position (0% to 100%)
    // Clamp to -100 to +100 range
    const clampedDeviation = Math.max(-100, Math.min(100, deviation));
    const position = ((clampedDeviation + 100) / 200) * 100;
    icon.style.left = `${position}%`;
    
    container.appendChild(icon);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

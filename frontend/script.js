// API Configuration
const API_BASE_URL = 'https://gen-ai-website-ba85.onrender.com/api';

// Occupation display name mapping
const occupationNames = {
    'administrativeassistant': 'Administrative Assistant',
    'author': 'Author',
    'bartender': 'Bartender',
    'biologist': 'Biologist',
    'buildinginspector': 'Building Inspector',
    'busdriver': 'Bus Driver',
    'butcher': 'Butcher',
    'chef': 'Chef',
    'chemist': 'Chemist',
    'chiefexecutiveofficer': 'Chief Executive Officer',
    'childcareworker': 'Childcare Worker',
    'computerprogrammer': 'Computer Programmer',
    'constructionworker': 'Construction Worker',
    'cook': 'Cook',
    'craneoperator': 'Crane Operator',
    'custodian': 'Custodian',
    'customerservicerepresentative': 'Customer Service Representative',
    'doctor': 'Doctor',
    'drafter': 'Drafter',
    'electrician': 'Electrician',
    'engineer': 'Engineer',
    'garbagecollector': 'Garbage Collector',
    'housekeeper': 'Housekeeper',
    'insurancesalesagent': 'Insurance Sales Agent',
    'labtech': 'Lab Tech',
    'librarian': 'Librarian',
    'mailcarrier': 'Mail Carrier',
    'nurse': 'Nurse',
    'nursepracticoner': 'Nurse Practitioner',
    'pharmacist': 'Pharmacist',
    'pilot': 'Pilot',
    'plumber': 'Plumber',
    'policeofficer': 'Police Officer',
    'primaryschoolteacher': 'Primary School Teacher',
    'receptionist': 'Receptionist',
    'roofer': 'Roofer',
    'securityguard': 'Security Guard',
    'softwaredeveloper': 'Software Developer',
    'specialedteacher': 'Special Ed Teacher',
    'truckdriver': 'Truck Driver',
    'welder': 'Welder',
};

function formatOccupationName(raw) {
    return occupationNames[raw.toLowerCase()] || raw;
}

// State management
let currentOccupation = null;
let currentModel = 'all';
let occupations = [];
let allDifferences = [];

// Model configurations
const modelConfig = {
    openai:   { icon: '💬', color: '#10a37f', name: 'ChatGPT' },
    gemini:   { icon: '◆',  color: '#8e44ad', name: 'Gemini' },
    deepseek: { icon: '🔍', color: '#3498db', name: 'DeepSeek' },
    mistral:  { icon: 'Ⓜ',  color: '#d97706', name: 'Mistral' }
};

const demographics = [
    { label: 'Women',    diffKey: 'diff_p_women'    },
    { label: 'White',    diffKey: 'diff_p_white'    },
    { label: 'Hispanic', diffKey: 'diff_p_hispanic' },
    { label: 'Black',    diffKey: 'diff_p_black'    },
    { label: 'Asian',    diffKey: 'diff_p_asian'    },
];

async function init() {
    setupEventListeners();
    await loadData();
}

function setupEventListeners() {
    document.querySelectorAll('.model-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentModel = e.currentTarget.dataset.model;
            if (currentOccupation) updateDisplay();
        });
    });
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function loadData() {
    const [occResult, diffResult] = await Promise.all([
        fetchAPI('/occupations'),
        fetchAPI('/differences')
    ]);

    if (occResult && occResult.success) {
        occupations = occResult.data;
        renderOccupationList();
    }

    if (diffResult && diffResult.success) {
        allDifferences = diffResult.data;
    }
}

function renderOccupationList() {
    const container = document.getElementById('occupationList');
    container.innerHTML = '';

    occupations.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'occupation-btn';
        btn.textContent = formatOccupationName(name);
        btn.dataset.rawName = name;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.occupation-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectOccupation(name);
        });

        container.appendChild(btn);
    });
}

function selectOccupation(name) {
    currentOccupation = name;
    document.getElementById('occupationTitle').textContent = formatOccupationName(name);
    updateDisplay();
}

function getRows(occupation, model) {
    return allDifferences.filter(row => {
        const occMatch = row.occupation.toLowerCase() === occupation.toLowerCase();
        const modelMatch = model === 'all' || row.model_name === model;
        return occMatch && modelMatch;
    });
}

function updateDisplay() {
    if (!currentOccupation) return;
    updateModelInfo();
    updateCharts();
}

function updateModelInfo() {
    const modelInfo = document.getElementById('modelInfo');
    const rows = getRows(currentOccupation, currentModel);

    if (currentModel === 'all' || rows.length === 0) {
        modelInfo.textContent = 'Showing all LLMs vs. the national baseline.';
        modelInfo.className = 'model-info neutral';
        return;
    }

    const row = rows[0];
    const modelName = modelConfig[currentModel]?.name || currentModel;

    let maxKey = null, maxVal = 0;
    demographics.forEach(d => {
        const val = parseFloat(row[d.diffKey]);
        if (!isNaN(val) && Math.abs(val) > Math.abs(maxVal)) {
            maxVal = val;
            maxKey = d.label;
        }
    });

    if (maxKey && Math.abs(maxVal) > 10) {
        const direction = maxVal > 0 ? 'overrepresented' : 'underrepresented';
        modelInfo.textContent = `${modelName} ${direction} ${maxKey} by ${Math.abs(maxVal).toFixed(1)}% in ${formatOccupationName(currentOccupation)}.`;
        modelInfo.className = 'model-info';
    } else {
        modelInfo.textContent = `${modelName} results for ${formatOccupationName(currentOccupation)}.`;
        modelInfo.className = 'model-info neutral';
    }
}

function updateCharts() {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';

    demographics.forEach(demo => {
        createChartRow(container, demo);
    });

    const axis = document.createElement('div');
    axis.className = 'chart-axis';
    axis.innerHTML = `
        <span class="axis-label left">-100%</span>
        <span class="axis-label center">0<br><span class="baseline-label">National Statistics Baseline</span></span>
        <span class="axis-label right">+100%</span>
    `;
    container.appendChild(axis);
}

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

    const rows = getRows(currentOccupation, currentModel);
    rows.forEach(dataRow => {
        const model = dataRow.model_name;
        const config = modelConfig[model];
        if (!config) return;
        const deviation = parseFloat(dataRow[demo.diffKey]);
        if (isNaN(deviation)) return;
        placeIcon(iconsContainer, deviation, config);
    });

    track.appendChild(iconsContainer);
    row.appendChild(label);
    row.appendChild(track);
    container.appendChild(row);
}

function placeIcon(container, deviation, config) {
    const icon = document.createElement('div');
    icon.className = 'icon-marker';
    icon.textContent = config.icon;
    icon.style.color = config.color;

    const clamped = Math.max(-100, Math.min(100, deviation));
    const position = ((clamped + 100) / 200) * 100;
    icon.style.left = `${position}%`;

    container.appendChild(icon);
}

document.addEventListener('DOMContentLoaded', init);

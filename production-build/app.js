// Consolidated app script for ZED Champions Tracker
console.log("ZED Champions Tracker loading...");

// Global state
window.horses = JSON.parse(localStorage.getItem('horses') || '[]');
window.races = JSON.parse(localStorage.getItem('races') || '[]');
window.breedingHorses = JSON.parse(localStorage.getItem('breedingHorses') || '[]');
window.bredHorses = JSON.parse(localStorage.getItem('bredHorses') || '[]');
window.studAuctions = JSON.parse(localStorage.getItem('studAuctions') || '[]');
window.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

// Authentication Manager
class ZedAuthManager {
  constructor() {
    this.tokenKey = 'zedTrackerAuthToken';
    this.tokenExpiryKey = 'zedTrackerAuthTokenExpiry';
  }
  
  parseJwt(token) {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Error parsing JWT token:", e);
      return null;
    }
  }
  
  isTokenExpired(token) {
    if (!token) return true;
    const payload = this.parseJwt(token);
    if (!payload?.exp) return true;
    return payload.exp < Math.floor(Date.now() / 1000);
  }
  
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }
  
  getTokenExpiry() {
    const expiryStr = localStorage.getItem(this.tokenExpiryKey);
    if (!expiryStr) return null;
    const expiryDate = new Date(expiryStr);
    const remaining = Math.max(0, expiryDate.getTime() - Date.now());
    return {
      date: expiryDate,
      remaining,
      expired: this.isTokenExpired(this.getToken())
    };
  }
  
  setToken(token) {
    if (!token) return false;
    
    // Clean token if it starts with "Bearer "
    if (token.startsWith('Bearer ')) {
      token = token.substring(7).trim();
    }
    
    try {
      const payload = this.parseJwt(token);
      if (!payload?.exp) return false;
      
      localStorage.setItem(this.tokenKey, token);
      const expiryDate = new Date(payload.exp * 1000);
      localStorage.setItem(this.tokenExpiryKey, expiryDate.toISOString());
      return true;
    } catch (error) {
      console.error("Error setting token:", error);
      return false;
    }
  }
}

// API Service
class ZedApiService {
  constructor(authManager) {
    this.authManager = authManager;
    
    // Dynamic API base URL that works across all environments
    const host = window.location.hostname;
    const isDev = host === 'localhost' || host === '127.0.0.1';
    
    // Important: Use the correct API base URL
    this.apiBase = isDev 
      ? 'http://localhost:3000/api/zed' 
      : '/api/zed';
    
    console.log(`API client initialized with base URL: ${this.apiBase}`);
  }
  
  async fetchFromApi(endpoint, method = 'GET', data = null) {
    if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
    
    const url = `${this.apiBase}${endpoint}`;
    console.log(`API Request: ${method} ${url}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Add authorization if we have a token
    const token = this.authManager.getToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add body data for non-GET requests
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }
  
  async testConnection() {
    try {
      if (!this.authManager.getToken()) {
        return { success: false, message: "No API token set. Please set your token first." };
      }
      
      const data = await this.fetchFromApi('/me');
      return {
        success: true,
        message: `Connected successfully. Welcome, ${data.username || 'racer'}!`,
        data
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  async fetchHorse(horseId) {
    try {
      const data = await this.fetchFromApi(`/horses/${horseId}`);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  async fetchAllHorses(type = 'racing') {
    try {
      const endpoint = type === 'racing' ? '/stable/racing' : '/stable/breeding';
      const data = await this.fetchFromApi(endpoint);
      return { success: true, data: data.horses || [] };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Save all data to localStorage
function saveData() {
  localStorage.setItem('horses', JSON.stringify(window.horses || []));
  localStorage.setItem('races', JSON.stringify(window.races || []));
  localStorage.setItem('breedingHorses', JSON.stringify(window.breedingHorses || []));
  localStorage.setItem('bredHorses', JSON.stringify(window.bredHorses || []));
  localStorage.setItem('studAuctions', JSON.stringify(window.studAuctions || []));
  localStorage.setItem('transactions', JSON.stringify(window.transactions || []));
  console.log("Data saved to localStorage");
}

// Tab Navigation
function setupTabs() {
  console.log("Setting up tabs...");
  const tabButtons = document.querySelectorAll('[data-tab]');
  
  if (!tabButtons.length) {
    console.warn("No tab buttons found");
    return;
  }
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Activate default tab or last selected tab
  const lastActiveTab = localStorage.getItem('zedTrackerActiveTab') || 'racing';
  activateTab(lastActiveTab);
}

function activateTab(tabId) {
  console.log("Activating tab:", tabId);
  
  // Update active state on buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  
  // Update active state on content divs
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-content-${tabId}`);
  });
  
  // Store the active tab
  localStorage.setItem('zedTrackerActiveTab', tabId);
}

// Bloodline functions and color mapping
window.breedColorOptions = {
  "Nakamoto": {
    "normal": [
      { label: "Bay", hex: "#5E3A22" },
      { label: "Black", hex: "#000000" }
    ],
    "rare": [
      { label: "White", hex: "#FFFFFF" }
    ],
    "super rare": [
      { label: "Gold", hex: "#FFD700" }
    ]
  },
  "Szabo": {
    "normal": [
      { label: "Gray", hex: "#808080" },
      { label: "Chestnut", hex: "#954535" }
    ],
    "rare": [
      { label: "Blue", hex: "#4169E1" }
    ],
    "super rare": [
      { label: "Silver", hex: "#C0C0C0" }
    ]
  },
  "Finney": {
    "normal": [
      { label: "Roan", hex: "#A76C64" },
      { label: "Palomino", hex: "#D9B280" }
    ],
    "rare": [
      { label: "Green", hex: "#4CAF50" }
    ],
    "super rare": [
      { label: "Bronze", hex: "#CD7F32" }
    ]
  },
  "Buterin": {
    "normal": [
      { label: "Dun", hex: "#D6B76F" },
      { label: "Buckskin", hex: "#CC9966" }
    ],
    "rare": [
      { label: "Purple", hex: "#8A2BE2" }
    ],
    "super rare": [
      { label: "Platinum", hex: "#E5E4E2" }
    ]
  }
};

window.bloodlineTraits = {
  "Nakamoto": ["Speed", "Endurance", "Agility"],
  "Szabo": ["Power", "Stamina", "Balance"],
  "Finney": ["Sprint", "Focus", "Acceleration"],
  "Buterin": ["Tenacity", "Consistency", "Resilience"]
};

window.bloodlineAttributes = {
  "Nakamoto": ["Lean", "Muscular", "Aerodynamic"],
  "Szabo": ["Strong", "Sturdy", "Powerful"],
  "Finney": ["Quick", "Light", "Agile"],
  "Buterin": ["Smart", "Steady", "Tactical"]
};

function onBloodlineChange(colorId, traitsId, attrsId) {
  console.log(`onBloodlineChange: color=${colorId}, traits=${traitsId}, attrs=${attrsId}`);
  const colorEl = document.getElementById(colorId);
  const traitsEl = document.getElementById(traitsId);
  const attrsEl = document.getElementById(attrsId);
  
  // Find the bloodline element
  const bloodId = colorId.replace('color', 'bloodline');
  const bloodEl = document.getElementById(bloodId);
  
  if (!bloodEl || !colorEl) return;
  
  // Get the selected bloodline
  const bloodline = bloodEl.value;
  
  // Update color options
  colorEl.innerHTML = '<option value="">--Select Color--</option>';
  
  if (bloodline && window.breedColorOptions && window.breedColorOptions[bloodline]) {
    ["normal", "rare", "super rare"].forEach(rarity => {
      if (window.breedColorOptions[bloodline][rarity]) {
        window.breedColorOptions[bloodline][rarity].forEach(color => {
          const option = document.createElement('option');
          option.value = color.hex;
          option.textContent = color.label;
          colorEl.appendChild(option);
        });
      }
    });
  }
  
  // Set the first color option as selected
  if (colorEl.options.length > 1) {
    colorEl.selectedIndex = 1;
  }
  
  // Update traits if element exists
  if (traitsEl && bloodline && window.bloodlineTraits && window.bloodlineTraits[bloodline]) {
    traitsEl.innerHTML = '';
    window.bloodlineTraits[bloodline].forEach(trait => {
      const option = document.createElement('option');
      option.value = trait;
      option.textContent = trait;
      traitsEl.appendChild(option);
    });
  }
  
  // Update attributes if element exists
  if (attrsEl && bloodline && window.bloodlineAttributes && window.bloodlineAttributes[bloodline]) {
    attrsEl.innerHTML = '';
    window.bloodlineAttributes[bloodline].forEach(attr => {
      const option = document.createElement('option');
      option.value = attr;
      option.textContent = attr;
      attrsEl.appendChild(option);
    });
  }
}

// Utility function for displaying status messages
function showStatus(element, message, isSuccess = null) {
  if (!element) return;
  
  element.style.display = 'block';
  element.innerHTML = message;
  
  if (isSuccess === true) {
    element.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
    element.style.color = '#4CAF50';
    element.style.padding = '8px 12px';
    element.style.borderRadius = '4px';
  } else if (isSuccess === false) {
    element.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
    element.style.color = '#F44336';
    element.style.padding = '8px 12px';
    element.style.borderRadius = '4px';
  } else {
    element.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
    element.style.color = '#2196F3';
    element.style.padding = '8px 12px';
    element.style.borderRadius = '4px';
  }
}

// Initialize API services
const zedAuth = new ZedAuthManager();
const zedApi = new ZedApiService(zedAuth);

// Define the global ZED_API object for backward compatibility
window.ZED_API = {
  authToken: zedAuth.getToken(),
  setToken: (token) => zedAuth.setToken(token),
  testConnection: () => zedApi.testConnection(),
  fetchHorse: (id) => zedApi.fetchHorse(id),
  fetchAllHorses: (type) => zedApi.fetchAllHorses(type),
  showStatus: showStatus
};

// Make functions available globally
window.activateTab = activateTab;
window.onBloodlineChange = onBloodlineChange;
window.showStatus = showStatus;
window.zedAuth = zedAuth;
window.zedApi = zedApi;
window.saveData = saveData;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log("Initializing ZED Champions Tracker...");
  
  setupTabs();
  
  // Set up bloodline change handlers
  const bloodlineSelects = [
    'horse-bloodline',
    'breeding-horse-bloodline'
  ];
  
  bloodlineSelects.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', function() {
        const colorId = id.replace('bloodline', 'color');
        const traitsId = id.replace('bloodline', 'traits');
        const attrsId = id.replace('bloodline', 'attributes');
        window.onBloodlineChange(colorId, traitsId, attrsId);
      });
    }
  });
  
  // Set up API import handlers
  setupApiHandlers();
});

// API Import UI setup
function setupApiHandlers() {
  const saveTokenBtn = document.getElementById('save-api-token-btn');
  const testConnectionBtn = document.getElementById('test-api-connection-btn');
  const importRacingBtn = document.getElementById('import-racing-stable-btn');
  const importBreedingBtn = document.getElementById('import-breeding-stable-btn');
  const importSingleBtn = document.getElementById('import-single-horse-btn');
  
  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', function() {
      const token = document.getElementById('zed-api-token').value.trim();
      if (token) {
        if (window.zedAuth.setToken(token)) {
          window.showStatus(
            document.getElementById('test-api-connection-status'),
            'Token saved successfully!',
            true
          );
          window.ZED_API.authToken = token;
        } else {
          window.showStatus(
            document.getElementById('test-api-connection-status'),
            'Invalid token format',
            false
          );
        }
      }
    });
  }
  
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async function() {
      const statusEl = document.getElementById('test-api-connection-status');
      window.showStatus(statusEl, 'Testing connection...', null);
      
      try {
        const result = await window.zedApi.testConnection();
        window.showStatus(statusEl, result.message, result.success);
      } catch (error) {
        window.showStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
  
  if (importRacingBtn) {
    importRacingBtn.addEventListener('click', async function() {
      const statusEl = document.getElementById('import-status');
      if (!window.zedAuth.getToken()) {
        window.showStatus(statusEl, 'No API token set. Please set your token first.', false);
        return;
      }
      
      window.showStatus(statusEl, 'Loading your racing stable... Please wait...', null);
      
      try {
        const result = await window.zedApi.fetchAllHorses('racing');
        
        if (!result.success) {
          window.showStatus(statusEl, `Error: ${result.message}`, false);
          return;
        }
        
        const horses = result.data;
        
        if (horses.length === 0) {
          window.showStatus(statusEl, "No racing horses found to import.", false);
          return;
        }
        
        // Process the horses
        let newCount = 0;
        let updateCount = 0;
        
        horses.forEach(horseData => {
          const existingHorse = window.horses.find(h => h.zedId === horseData.id);
          
          const processedHorse = {
            id: existingHorse?.id || crypto.randomUUID(),
            name: horseData.name,
            bloodline: horseData.bloodline,
            color: horseData.color || '#CCCCCC',
            gender: horseData.gender,
            stars: horseData.overall_rating || null,
            speedStars: horseData.speed_rating || null,
            sprintStars: horseData.sprint_rating || null,
            enduranceStars: horseData.endurance_rating || null,
            initialZedBalance: existingHorse?.initialZedBalance || 0,
            initialMmRating: existingHorse?.initialMmRating || 1000,
            status: 'racing',
            zedId: horseData.id,
            lastUpdated: new Date().toISOString()
          };
          
          if (existingHorse) {
            Object.assign(existingHorse, processedHorse);
            updateCount++;
          } else {
            window.horses.push(processedHorse);
            newCount++;
          }
        });
        
        // Save and update UI
        window.saveData();
        
        if (typeof window.renderHorsesTable === 'function') {
          window.renderHorsesTable();
        }
        
        window.showStatus(
          statusEl, 
          `Successfully imported ${horses.length} racing horses (${newCount} new, ${updateCount} updated)`,
          true
        );
        
        // Switch to Racing tab
        window.activateTab('racing');
      } catch (error) {
        console.error("Error importing racing stable:", error);
        window.showStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
  
  if (importBreedingBtn) {
    importBreedingBtn.addEventListener('click', async function() {
      const statusEl = document.getElementById('import-status');
      if (!window.zedAuth.getToken()) {
        window.showStatus(statusEl, 'No API token set. Please set your token first.', false);
        return;
      }
      
      window.showStatus(statusEl, 'Loading your breeding stable... Please wait...', null);
      
      try {
        const result = await window.zedApi.fetchAllHorses('breeding');
        
        if (!result.success) {
          window.showStatus(statusEl, `Error: ${result.message}`, false);
          return;
        }
        
        const horses = result.data;
        
        if (horses.length === 0) {
          window.showStatus(statusEl, "No breeding horses found to import.", false);
          return;
        }
        
        // Process the horses
        let newCount = 0;
        let updateCount = 0;
        
        horses.forEach(horseData => {
          const existingHorse = window.breedingHorses.find(h => h.zedId === horseData.id);
          
          const processedHorse = {
            id: existingHorse?.id || crypto.randomUUID(),
            name: horseData.name,
            bloodline: horseData.bloodline,
            color: horseData.color || '#CCCCCC',
            gender: horseData.gender,
            stars: horseData.overall_rating || null,
            status: 'breeding',
            zedId: horseData.id,
            lastUpdated: new Date().toISOString()
          };
          
          if (existingHorse) {
            Object.assign(existingHorse, processedHorse);
            updateCount++;
          } else {
            window.breedingHorses.push(processedHorse);
            newCount++;
          }
        });
        
        // Save and update UI
        window.saveData();
        
        if (typeof window.renderBreedingHorsesTable === 'function') {
          window.renderBreedingHorsesTable();
        }
        
        window.showStatus(
          statusEl, 
          `Successfully imported ${horses.length} breeding horses (${newCount} new, ${updateCount} updated)`,
          true
        );
        
        // Switch to Breeding tab
        window.activateTab('breeding');
      } catch (error) {
        console.error("Error importing breeding stable:", error);
        window.showStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
  
  if (importSingleBtn) {
    importSingleBtn.addEventListener('click', async function() {
      const horseId = document.getElementById('zed-horse-id').value.trim();
      const importType = document.getElementById('import-horse-type').value;
      const statusEl = document.getElementById('single-import-status');
      
      if (!horseId) {
        window.showStatus(statusEl, 'Please enter a horse ID', false);
        return;
      }
      
      if (!window.zedAuth.getToken()) {
        window.showStatus(statusEl, 'No API token set. Please set your token first.', false);
        return;
      }
      
      window.showStatus(statusEl, `Importing horse ${horseId}...`, null);
      
      try {
        const result = await window.zedApi.fetchHorse(horseId);
        
        if (!result.success) {
          window.showStatus(statusEl, `Error: ${result.message}`, false);
          return;
        }
        
        const horseData = result.data;
        
        if (importType === 'racing') {
          const existingHorse = window.horses.find(h => h.zedId === horseData.id);
          
          const processedHorse = {
            id: existingHorse?.id || crypto.randomUUID(),
            name: horseData.name,
            bloodline: horseData.bloodline,
            color: horseData.color || '#CCCCCC',
            gender: horseData.gender,
            stars: horseData.overall_rating || null,
            speedStars: horseData.speed_rating || null,
            sprintStars: horseData.sprint_rating || null,
            enduranceStars: horseData.endurance_rating || null,
            initialZedBalance: existingHorse?.initialZedBalance || 0,
            initialMmRating: existingHorse?.initialMmRating || 1000,
            status: 'racing',
            zedId: horseData.id,
            lastUpdated: new Date().toISOString()
          };
          
          if (existingHorse) {
            Object.assign(existingHorse, processedHorse);
            window.showStatus(statusEl, `Updated horse: ${horseData.name}`, true);
          } else {
            window.horses.push(processedHorse);
            window.showStatus(statusEl, `Imported new horse: ${horseData.name}`, true);
          }
          
          window.saveData();
          if (typeof window.renderHorsesTable === 'function') {
            window.renderHorsesTable();
          }
          window.activateTab('racing');
        } else {
          const existingHorse = window.breedingHorses.find(h => h.zedId === horseData.id);
          
          const processedHorse = {
            id: existingHorse?.id || crypto.randomUUID(),
            name: horseData.name,
            bloodline: horseData.bloodline,
            color: horseData.color || '#CCCCCC',
            gender: horseData.gender,
            stars: horseData.overall_rating || null,
            status: 'breeding',
            zedId: horseData.id,
            lastUpdated: new Date().toISOString()
          };
          
          if (existingHorse) {
            Object.assign(existingHorse, processedHorse);
            window.showStatus(statusEl, `Updated horse: ${horseData.name}`, true);
          } else {
            window.breedingHorses.push(processedHorse);
            window.showStatus(statusEl, `Imported new horse: ${horseData.name}`, true);
          }
          
          window.saveData();
          if (typeof window.renderBreedingHorsesTable === 'function') {
            window.renderBreedingHorsesTable();
          }
          window.activateTab('breeding');
        }
      } catch (error) {
        console.error("Error importing single horse:", error);
        window.showStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
}
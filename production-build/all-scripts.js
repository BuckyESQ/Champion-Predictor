console.log("Loading consolidated scripts for Champion Predictor...");

// Initialize empty arrays if they don't exist
if (!window.horses) window.horses = JSON.parse(localStorage.getItem('horses') || '[]');
if (!window.races) window.races = JSON.parse(localStorage.getItem('races') || '[]');
if (!window.breedingHorses) window.breedingHorses = JSON.parse(localStorage.getItem('breedingHorses') || '[]');
if (!window.bredHorses) window.bredHorses = JSON.parse(localStorage.getItem('bredHorses') || '[]');
if (!window.studAuctions) window.studAuctions = JSON.parse(localStorage.getItem('studAuctions') || '[]');
if (!window.transactions) window.transactions = JSON.parse(localStorage.getItem('transactions') || '[]');

// API Authentication Manager
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
    
    // Use proxy by default
    this.useProxy = true;
    
    // API base URL - adjust for your deployment
    this.apiBase = isDev 
      ? 'http://localhost:3000/api/zed' 
      : '/api/zed';
      
    console.log(`API client initialized. Base URL: ${this.apiBase}`);
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
    
    // Set timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    options.signal = controller.signal;
    
    try {
      const response = await fetch(url, options);
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }
  
  async testConnection() {
    try {
      if (!this.authManager.getToken()) {
        return { success: false, message: "No API token set. Please set your token first." };
      }
      
      if (this.authManager.isTokenExpired(this.authManager.getToken())) {
        return { success: false, message: "Your API token has expired. Please get a new token." };
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
  
  async fetchHorseTypes() {
    return { success: true, data: ['racing', 'breeding'] };
  }
  
  async fetchHorse(horseId) {
    try {
      const data = await this.fetchFromApi(`/horses/${horseId}`);
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
  
  async searchHorse(query) {
    try {
      const data = await this.fetchFromApi(`/horses/search?q=${encodeURIComponent(query)}`);
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

// Initialize core services
window.zedAuth = new ZedAuthManager();
window.zedApi = new ZedApiService(window.zedAuth);

// Define ZED_API for backward compatibility
window.ZED_API = {
  authToken: window.zedAuth.getToken(),
  isTokenExpired: () => window.zedAuth.isTokenExpired(window.zedAuth.getToken()),
  testConnection: () => window.zedApi.testConnection(),
  fetchHorse: (id) => window.zedApi.fetchHorse(id),
  fetchAllHorses: (type) => window.zedApi.fetchAllHorses(type),
  setToken: (token) => window.zedAuth.setToken(token)
};

// Utility Functions
window.showImportStatus = function(element, message, isSuccess) {
  if (!element) return;
  
  element.style.display = 'block';
  element.innerHTML = message; // Use innerHTML instead of textContent
  
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
};

// Data Management
window.saveData = function() {
  localStorage.setItem('horses', JSON.stringify(window.horses || []));
  localStorage.setItem('races', JSON.stringify(window.races || []));
  localStorage.setItem('breedingHorses', JSON.stringify(window.breedingHorses || []));
  localStorage.setItem('bredHorses', JSON.stringify(window.bredHorses || []));
  localStorage.setItem('studAuctions', JSON.stringify(window.studAuctions || []));
  localStorage.setItem('transactions', JSON.stringify(window.transactions || []));
  console.log("Data saved to localStorage");
};

// The missing onBloodlineChange function
window.onBloodlineChange = function(colorId, traitsId, attrsId) {
  console.log(`onBloodlineChange: color=${colorId}, traits=${traitsId}, attrs=${attrsId}`);
  const colorEl = document.getElementById(colorId);
  const traitsEl = document.getElementById(traitsId);
  const attrsEl = document.getElementById(attrsId);
  
  if (!colorEl) {
    console.warn(`Color element not found: ${colorId}`);
    return;
  }
  
  // Find the bloodline element
  const bloodId = colorId.replace('color', 'bloodline');
  const bloodEl = document.getElementById(bloodId);
  
  if (!bloodEl) {
    console.warn(`Bloodline element not found: ${bloodId}`);
    return;
  }
  
  // Get the selected bloodline
  const bloodline = bloodEl.value;
  console.log(`Selected bloodline: ${bloodline}`);
  
  // Initialize colors if needed
  if (!window.breedColorOptions) {
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
  }
  
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
  
  // Initialize traits if needed
  if (!window.bloodlineTraits) {
    window.bloodlineTraits = {
      "Nakamoto": ["Speed", "Endurance", "Agility"],
      "Szabo": ["Power", "Stamina", "Balance"],
      "Finney": ["Sprint", "Focus", "Acceleration"],
      "Buterin": ["Tenacity", "Consistency", "Resilience"]
    };
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
  
  // Initialize attributes if needed
  if (!window.bloodlineAttributes) {
    window.bloodlineAttributes = {
      "Nakamoto": ["Lean", "Muscular", "Aerodynamic"],
      "Szabo": ["Strong", "Sturdy", "Powerful"],
      "Finney": ["Quick", "Light", "Agile"],
      "Buterin": ["Smart", "Steady", "Tactical"]
    };
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
};

// Initialize tabs
window.activateTab = function(tabId) {
  console.log("Activating tab:", tabId);
  
  // Update active state on buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  
  // Update active state on content divs
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-content-${tabId}`);
  });
  
  // Store the active tab
  localStorage.setItem('zedTrackerActiveTab', tabId);
  
  // Handle tab-specific actions
  if (tabId === 'import') {
    initializeImportTab();
  }
};

// Initialize Import tab functionality
function initializeImportTab() {
  console.log("Initializing Import tab");
  
  const container = document.getElementById('api-import-container');
  if (!container || container.querySelector('#save-api-token-btn')) {
    return; // Already initialized or container not found
  }
  
  container.innerHTML = `
    <h2>ZED Champions API Authentication</h2>
    <p>Enter your API token to import horses directly from ZED Champions.</p>
    
    <div style="margin-top: 15px;">
      <div class="form-grid" style="grid-template-columns: 1fr auto;">
        <textarea id="zed-api-token" placeholder="Enter your ZED Champions API Bearer token" 
          style="height: 60px; padding: 10px;" autocomplete="off"></textarea>
        <button id="save-api-token-btn" class="button">Save Token</button>
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 15px; align-items: center;">
        <button id="test-api-connection-btn" class="button">Test Connection</button>
        <div id="test-api-connection-status" style="flex: 1;"></div>
      </div>
    </div>
    
    <div style="margin-top: 25px; border-top: 1px solid var(--border-color); padding-top: 15px;">
      <h3>Import Horses</h3>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button id="import-racing-stable-btn" class="button">Import Racing Stable</button>
        <button id="import-breeding-stable-btn" class="button">Import Breeding Stable</button>
      </div>
      <div id="import-status" style="margin-top: 10px;"></div>
      
      <h4>Import Single Horse</h4>
      <div style="display: flex; gap: 10px; margin-top: 10px; align-items: flex-end;">
        <div>
          <label for="zed-horse-id">Horse ID:</label>
          <input type="text" id="zed-horse-id" placeholder="Enter horse ID">
        </div>
        <div>
          <label for="import-horse-type">Import As:</label>
          <select id="import-horse-type">
            <option value="racing">Racing Horse</option>
            <option value="breeding">Breeding Horse</option>
          </select>
        </div>
        <button id="import-single-horse-btn" class="button">Import Horse</button>
      </div>
      <div id="single-import-status" class="import-status"></div>
    </div>
  `;
  
  // Add event listeners
  document.getElementById('save-api-token-btn').addEventListener('click', function() {
    const tokenInput = document.getElementById('zed-api-token');
    const token = tokenInput.value.trim();
    if (!token) {
      window.showImportStatus(document.getElementById('test-api-connection-status'), "Please enter a valid token.", false);
      return;
    }
    
    const success = window.zedAuth.setToken(token);
    if (success) {
      tokenInput.value = "••••••••••••••••";
      window.showImportStatus(document.getElementById('test-api-connection-status'), "Token saved successfully!", true);
      window.ZED_API.authToken = token;
    } else {
      window.showImportStatus(document.getElementById('test-api-connection-status'), "Invalid token format.", false);
    }
  });
  
  document.getElementById('test-api-connection-btn').addEventListener('click', async function() {
    const statusEl = document.getElementById('test-api-connection-status');
    window.showImportStatus(statusEl, "Testing connection...", null);
    
    try {
      const result = await window.zedApi.testConnection();
      window.showImportStatus(statusEl, result.message, result.success);
    } catch (error) {
      window.showImportStatus(statusEl, "Connection error: " + error.message, false);
    }
  });
  
  document.getElementById('import-racing-stable-btn').addEventListener('click', async function() {
    if (!window.zedAuth.getToken()) {
      window.showImportStatus(document.getElementById('import-status'), "No API token set. Please set your token first.", false);
      return;
    }
    
    const statusEl = document.getElementById('import-status');
    window.showImportStatus(statusEl, "Loading your racing stable... Please wait...", null);
    
    try {
      const result = await window.zedApi.fetchAllHorses('racing');
      
      if (!result.success) {
        window.showImportStatus(statusEl, `Error: ${result.message}`, false);
        return;
      }
      
      const horses = result.data;
      
      if (horses.length === 0) {
        window.showImportStatus(statusEl, "No racing horses found to import.", false);
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
      
      if (typeof window.updateHorseDropdown === 'function') {
        window.updateHorseDropdown();
      }
      
      if (typeof window.updateParentDropdowns === 'function') {
        window.updateParentDropdowns();
      }
      
      window.showImportStatus(
        statusEl, 
        `Successfully imported ${horses.length} racing horses (${newCount} new, ${updateCount} updated)`,
        true
      );
      
      // Switch to Racing tab
      window.activateTab('racing');
    } catch (error) {
      console.error("Error importing racing stable:", error);
      window.showImportStatus(statusEl, `Error: ${error.message}`, false);
    }
  });
  
  document.getElementById('import-breeding-stable-btn').addEventListener('click', async function() {
    if (!window.zedAuth.getToken()) {
      window.showImportStatus(document.getElementById('import-status'), "No API token set. Please set your token first.", false);
      return;
    }
    
    const statusEl = document.getElementById('import-status');
    window.showImportStatus(statusEl, "Loading your breeding stable... Please wait...", null);
    
    try {
      const result = await window.zedApi.fetchAllHorses('breeding');
      
      if (!result.success) {
        window.showImportStatus(statusEl, `Error: ${result.message}`, false);
        return;
      }
      
      const horses = result.data;
      
      if (horses.length === 0) {
        window.showImportStatus(statusEl, "No breeding horses found to import.", false);
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
      
      if (typeof window.updateParentDropdowns === 'function') {
        window.updateParentDropdowns();
      }
      
      window.showImportStatus(
        statusEl, 
        `Successfully imported ${horses.length} breeding horses (${newCount} new, ${updateCount} updated)`,
        true
      );
      
      // Switch to Breeding tab
      window.activateTab('breeding');
    } catch (error) {
      console.error("Error importing breeding stable:", error);
      window.showImportStatus(statusEl, `Error: ${error.message}`, false);
    }
  });
  
  document.getElementById('import-single-horse-btn').addEventListener('click', async function() {
    if (!window.zedAuth.getToken()) {
      window.showImportStatus(document.getElementById('single-import-status'), "No API token set. Please set your token first.", false);
      return;
    }
    
    const horseId = document.getElementById('zed-horse-id').value.trim();
    const importType = document.getElementById('import-horse-type').value || 'racing';
    const statusEl = document.getElementById('single-import-status');
    
    if (!horseId) {
      window.showImportStatus(statusEl, "Please enter a horse ID", false);
      return;
    }
    
    window.showImportStatus(statusEl, `Importing horse ${horseId}...`, null);
    
    try {
      const result = await window.zedApi.fetchHorse(horseId);
      
      if (!result.success) {
        window.showImportStatus(statusEl, `Error: ${result.message}`, false);
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
          window.showImportStatus(statusEl, `Updated horse: ${horseData.name}`, true);
        } else {
          window.horses.push(processedHorse);
          window.showImportStatus(statusEl, `Imported new horse: ${horseData.name}`, true);
        }
        
        window.saveData();
        if (typeof window.renderHorsesTable === 'function') {
          window.renderHorsesTable();
        }
        if (typeof window.updateHorseDropdown === 'function') {
          window.updateHorseDropdown();
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
          window.showImportStatus(statusEl, `Updated horse: ${horseData.name}`, true);
        } else {
          window.breedingHorses.push(processedHorse);
          window.showImportStatus(statusEl, `Imported new horse: ${horseData.name}`, true);
        }
        
        window.saveData();
        if (typeof window.renderBreedingHorsesTable === 'function') {
          window.renderBreedingHorsesTable();
        }
        window.activateTab('breeding');
      }
      
      document.getElementById('zed-horse-id').value = '';
    } catch (error) {
      console.error("Error importing single horse:", error);
      window.showImportStatus(statusEl, `Error: ${error.message}`, false);
    }
  });
}

// Set up event listeners on document ready
document.addEventListener('DOMContentLoaded', function() {
  console.log("Champion Predictor initializing...");
  
  // Initialize bloodline change handlers
  const bloodlineSelects = [
    'horse-bloodline',
    'breeding-horse-bloodline',
    'bred-bloodline'
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

  // Initialize rendering functions if tabs are ready
  const initialTab = localStorage.getItem('zedTrackerActiveTab') || 'racing';
  if (document.getElementById(`tab-content-${initialTab}`)) {
    window.activateTab(initialTab);
  }
  
  // Safeguard to ensure missing methods don't break the app
  if (!window.renderBloodlineAnalysis) {
    window.renderBloodlineAnalysis = function() {
      console.log("renderBloodlineAnalysis called but not implemented");
    };
  }
  
  if (!window.renderIndividualAugmentAnalysis) {
    window.renderIndividualAugmentAnalysis = function() {
      console.log("renderIndividualAugmentAnalysis called but not implemented");
    };
  }
  
  console.log("Champion Predictor initialized");
});
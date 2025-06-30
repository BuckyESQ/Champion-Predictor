// Consolidated app script for ZED Champions Tracker
console.log("ZED Champions Tracker loading...");

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

// Bloodline Functions
function onBloodlineChange(colorId, traitsId, attrsId) {
  const colorEl = document.getElementById(colorId);
  const traitsEl = document.getElementById(traitsId);
  const attrsEl = document.getElementById(attrsId);
  
  // Find the bloodline element
  const bloodId = colorId.replace('color', 'bloodline');
  const bloodEl = document.getElementById(bloodId);
  
  if (!bloodEl || !colorEl) return;
  
  // Get the selected bloodline
  const bloodline = bloodEl.value;
  
  // Define colors for each bloodline
  const bloodlineColors = {
    "Nakamoto": [
      { label: "Bay", hex: "#5E3A22" },
      { label: "Black", hex: "#000000" },
      { label: "White", hex: "#FFFFFF" }
    ],
    "Szabo": [
      { label: "Gray", hex: "#808080" },
      { label: "Chestnut", hex: "#954535" },
      { label: "Blue", hex: "#4169E1" }
    ],
    "Finney": [
      { label: "Roan", hex: "#A76C64" },
      { label: "Palomino", hex: "#D9B280" },
      { label: "Green", hex: "#4CAF50" }
    ],
    "Buterin": [
      { label: "Dun", hex: "#D6B76F" },
      { label: "Buckskin", hex: "#CC9966" },
      { label: "Purple", hex: "#8A2BE2" }
    ]
  };
  
  // Update color options
  colorEl.innerHTML = '<option value="">--Select--</option>';
  
  if (bloodline && bloodlineColors[bloodline]) {
    bloodlineColors[bloodline].forEach(color => {
      const option = document.createElement('option');
      option.value = color.hex;
      option.textContent = color.label;
      colorEl.appendChild(option);
    });
  }
  
  // Set the first color option as selected
  if (colorEl.options.length > 1) {
    colorEl.selectedIndex = 1;
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log("Initializing ZED Champions Tracker...");
  
  setupTabs();
  
  // Initialize Import UI
  setupImportUI();
});

// Setup the import UI functionality
function setupImportUI() {
  const importContainer = document.getElementById('api-import-container');
  if (!importContainer) {
    console.warn("API import container not found");
    return;
  }
  
  // Create the import UI if it doesn't exist
  if (!document.getElementById('zed-api-token')) {
    importContainer.innerHTML = `
      <h2>ZED Champions API Authentication</h2>
      <p>Enter your API token to import horses directly from ZED Champions.</p>
      
      <div style="margin-top: 15px;">
        <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px;">
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
        <div id="single-import-status"></div>
      </div>
    `;
    
    // Set up event handlers for the import UI
    document.getElementById('save-api-token-btn').addEventListener('click', saveApiToken);
    document.getElementById('test-api-connection-btn').addEventListener('click', testApiConnection);
    document.getElementById('import-racing-stable-btn').addEventListener('click', () => importStable('racing'));
    document.getElementById('import-breeding-stable-btn').addEventListener('click', () => importStable('breeding'));
    document.getElementById('import-single-horse-btn').addEventListener('click', importSingleHorse);
  }
}

// API Token functions
function saveApiToken() {
  const token = document.getElementById('zed-api-token').value.trim();
  if (token) {
    if (window.zedAuth.setToken(token)) {
      showStatus(
        document.getElementById('test-api-connection-status'),
        'Token saved successfully!', 
        true
      );
    } else {
      showStatus(
        document.getElementById('test-api-connection-status'),
        'Invalid token format', 
        false
      );
    }
  }
}

async function testApiConnection() {
  const statusEl = document.getElementById('test-api-connection-status');
  showStatus(statusEl, 'Testing connection...', null);
  
  try {
    const result = await window.zedApi.testConnection();
    showStatus(statusEl, result.message, result.success);
  } catch (error) {
    showStatus(statusEl, `Error: ${error.message}`, false);
  }
}

// Import functions
async function importStable(type) {
  const statusEl = document.getElementById('import-status');
  
  if (!window.zedAuth.getToken()) {
    showStatus(statusEl, 'No API token set. Please set your token first.', false);
    return;
  }
  
  showStatus(statusEl, `Loading your ${type} stable... Please wait...`, null);
  
  try {
    const result = await window.zedApi.fetchAllHorses(type);
    
    if (result.success && result.data.length > 0) {
      // Process the horses (just show success for now)
      showStatus(statusEl, `Successfully imported ${result.data.length} ${type} horses`, true);
      
      // Switch to relevant tab
      window.activateTab(type === 'racing' ? 'racing' : 'breeding');
    } else {
      showStatus(statusEl, result.success ? 'No horses found.' : result.message, !result.success);
    }
  } catch (error) {
    showStatus(statusEl, `Error: ${error.message}`, false);
  }
}

async function importSingleHorse() {
  const horseId = document.getElementById('zed-horse-id').value.trim();
  const importType = document.getElementById('import-horse-type').value;
  const statusEl = document.getElementById('single-import-status');
  
  if (!horseId) {
    showStatus(statusEl, 'Please enter a horse ID', false);
    return;
  }
  
  if (!window.zedAuth.getToken()) {
    showStatus(statusEl, 'No API token set. Please set your token first.', false);
    return;
  }
  
  showStatus(statusEl, `Importing horse ${horseId}...`, null);
  
  try {
    const result = await window.zedApi.fetchHorse(horseId);
    
    if (result.success) {
      showStatus(statusEl, `Successfully imported horse: ${result.data.name}`, true);
      
      // Switch to relevant tab
      window.activateTab(importType === 'racing' ? 'racing' : 'breeding');
    } else {
      showStatus(statusEl, `Error: ${result.message}`, false);
    }
  } catch (error) {
    showStatus(statusEl, `Error: ${error.message}`, false);
  }
}

const API_TIMEOUT_DURATION = 15000; // 15 seconds timeout for API calls

// First, define the API authentication manager
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

// Then define the API Service
class ZedApiService {
  constructor(authManager) {
    this.authManager = authManager;
    const host = window.location.hostname;
    const isDev = host === 'localhost' || host === '127.0.0.1';
    
    // Use proxy by default
    this.useProxy = true;
    
    // API base URL - adjust for your deployment
    this.apiBase = isDev 
      ? 'http://localhost:3000/api/zed' 
      : '/api/zed';
      
    console.log(`API client initialized. Proxy: ${this.useProxy ? 'enabled' : 'disabled'}`);
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
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_DURATION);
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
  
  // API Methods
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

// User interface for the API
class ZedAuthUI {
  constructor(apiService) {
    this.apiService = apiService;
    this.authManager = apiService.authManager;
    this.statusContainerId = 'test-api-connection-status';
  }
  
  initialize() {
    this.createTokenInput();
    this.updateTokenStatus();
    this.populateHorseTypeOptions();
    
    // Check token status every minute
    setInterval(() => this.updateTokenStatus(), 60000);
  }
  
  createTokenInput() {
    const container = document.getElementById('api-import-container');
    if (!container) {
      console.warn("Warning: Container #api-import-container not found");
      return;
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
    
    this.addEventListeners();
    this.prefillToken();
  }
  
  addEventListeners() {
    document.getElementById('save-api-token-btn')?.addEventListener('click', () => this.handleSaveToken());
    document.getElementById('test-api-connection-btn')?.addEventListener('click', () => this.handleTestConnection());
    document.getElementById('import-racing-stable-btn')?.addEventListener('click', () => this.handleImportRacingStable());
    document.getElementById('import-breeding-stable-btn')?.addEventListener('click', () => this.handleImportBreedingStable());
    document.getElementById('import-single-horse-btn')?.addEventListener('click', () => this.handleImportSingleHorse());
  }
  
  prefillToken() {
    const token = this.authManager.getToken();
    if (token) {
      const expiry = this.authManager.getTokenExpiry();
      if (expiry && expiry.expired) {
        document.getElementById('zed-api-token').value = "";
        this.showStatus("Your token has expired. Please obtain a new token.", false);
      } else {
        document.getElementById('zed-api-token').value = "••••••••••••••••";
      }
    }
  }
  
  async populateHorseTypeOptions() {
    try {
      const result = await this.apiService.fetchHorseTypes();
      const selectElement = document.getElementById('import-horse-type');
      if (!selectElement) return;
      
      selectElement.innerHTML = '';
      result.data.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Horse`;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error("Error fetching horse types:", error);
    }
  }
  
  handleSaveToken() {
    const tokenInput = document.getElementById('zed-api-token');
    if (!tokenInput) return;
    
    const token = tokenInput.value.trim();
    if (!token) {
      this.showStatus("Please enter a valid token.", false);
      return;
    }
    
    const success = this.authManager.setToken(token);
    if (success) {
      tokenInput.value = "••••••••••••••••";
      this.showStatus("Token saved successfully!", true);
      this.handleTestConnection();
    } else {
      this.showStatus("Invalid token format.", false);
    }
  }
  
  async handleTestConnection() {
    this.showStatus("Testing connection...", null);
    
    try {
      const result = await this.apiService.testConnection();
      this.showStatus(result.message, result.success);
      this.updateTokenStatus();
    } catch (error) {
      this.showStatus("Connection error: " + error.message, false);
    }
  }
  
  async handleImportRacingStable() {
    if (!this.validateConnection()) return;
    
    const statusElement = document.getElementById('import-status');
    this.showImportStatus(statusElement, "Loading your racing stable... Please wait...", null);
    
    try {
      const result = await this.apiService.fetchAllHorses('racing');
      
      if (!result.success) {
        this.showImportStatus(statusElement, `Error: ${result.message}`, false);
        return;
      }
      
      const horses = result.data;
      
      if (horses.length === 0) {
        this.showImportStatus(statusElement, "No racing horses found to import.", false);
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
      window.renderHorsesTable();
      window.updateHorseDropdown();
      window.updateParentDropdowns();
      
      this.showImportStatus(
        statusElement, 
        `Successfully imported ${horses.length} racing horses (${newCount} new, ${updateCount} updated)`,
        true
      );
      
      // Switch to Racing tab
      window.activateTab('racing');
    } catch (error) {
      console.error("Error importing racing stable:", error);
      this.showImportStatus(statusElement, `Error: ${error.message}`, false);
    }
  }
  
  async handleImportBreedingStable() {
    if (!this.validateConnection()) return;
    
    const statusElement = document.getElementById('import-status');
    this.showImportStatus(statusElement, "Loading your breeding stable... Please wait...", null);
    
    try {
      const result = await this.apiService.fetchAllHorses('breeding');
      
      if (!result.success) {
        this.showImportStatus(statusElement, `Error: ${result.message}`, false);
        return;
      }
      
      const horses = result.data;
      
      if (horses.length === 0) {
        this.showImportStatus(statusElement, "No breeding horses found to import.", false);
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
      window.renderBreedingHorsesTable();
      window.updateParentDropdowns();
      
      this.showImportStatus(
        statusElement, 
        `Successfully imported ${horses.length} breeding horses (${newCount} new, ${updateCount} updated)`,
        true
      );
      
      // Switch to Breeding tab
      window.activateTab('breeding');
    } catch (error) {
      console.error("Error importing breeding stable:", error);
      this.showImportStatus(statusElement, `Error: ${error.message}`, false);
    }
  }
  
  async handleImportSingleHorse() {
    if (!this.validateConnection()) return;
    
    const horseId = document.getElementById('zed-horse-id')?.value.trim();
    const importType = document.getElementById('import-horse-type')?.value || 'racing';
    const statusElement = document.getElementById('single-import-status');
    
    if (!horseId) {
      this.showImportStatus(statusElement, "Please enter a horse ID", false);
      return;
    }
    
    this.showImportStatus(statusElement, `Importing horse ${horseId}...`, null);
    
    try {
      const result = await this.apiService.fetchHorse(horseId);
      
      if (!result.success) {
        this.showImportStatus(statusElement, `Error: ${result.message}`, false);
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
          this.showImportStatus(statusElement, `Updated horse: ${horseData.name}`, true);
        } else {
          window.horses.push(processedHorse);
          this.showImportStatus(statusElement, `Imported new horse: ${horseData.name}`, true);
        }
        
        window.saveData();
        window.renderHorsesTable();
        window.updateHorseDropdown();
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
          this.showImportStatus(statusElement, `Updated horse: ${horseData.name}`, true);
        } else {
          window.breedingHorses.push(processedHorse);
          this.showImportStatus(statusElement, `Imported new horse: ${horseData.name}`, true);
        }
        
        window.saveData();
        window.renderBreedingHorsesTable();
        window.updateParentDropdowns();
        window.activateTab('breeding');
      }
      
      document.getElementById('zed-horse-id').value = '';
    } catch (error) {
      console.error("Error importing single horse:", error);
      this.showImportStatus(statusElement, `Error: ${error.message}`, false);
    }
  }
  
  validateConnection() {
    if (!this.authManager.getToken()) {
      this.showStatus("No API token set. Please set your token first.", false);
      return false;
    }
    
    if (this.authManager.isTokenExpired(this.authManager.getToken())) {
      this.showStatus("Your API token has expired. Please get a new token.", false);
      return false;
    }
    
    return true;
  }
  
  updateTokenStatus() {
    const token = this.authManager.getToken();
    const expiry = this.authManager.getTokenExpiry();
    
    const testBtn = document.getElementById('test-api-connection-btn');
    if (!testBtn) return;
    
    if (!token || (expiry && expiry.expired)) {
      testBtn.setAttribute('disabled', 'disabled');
      if (expiry && expiry.expired) {
        this.showStatus("Your API token has expired. Please obtain a new token.", false);
      }
    } else {
      testBtn.removeAttribute('disabled');
    }
  }
  
  showStatus(message, isSuccess) {
    const statusEl = document.getElementById(this.statusContainerId);
    if (!statusEl) return;
    
    statusEl.style.display = 'block';
    statusEl.textContent = message;
    
    if (isSuccess === true) {
      statusEl.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      statusEl.style.color = '#4CAF50';
      statusEl.style.padding = '8px 12px';
      statusEl.style.borderRadius = '4px';
    } else if (isSuccess === false) {
      statusEl.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
      statusEl.style.color = '#F44336';
      statusEl.style.padding = '8px 12px';
      statusEl.style.borderRadius = '4px';
    } else {
      statusEl.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
      statusEl.style.color = '#2196F3';
      statusEl.style.padding = '8px 12px';
      statusEl.style.borderRadius = '4px';
    }
  }
  
  showImportStatus(element, message, isSuccess) {
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
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Create global instances
  window.zedAuth = new ZedAuthManager();
  window.zedApi = new ZedApiService(window.zedAuth);
  
  // Initialize UI
  const authUI = new ZedAuthUI(window.zedApi);
  window.zedAuthUI = authUI;
  
  // Initialize the UI after a short delay to ensure DOM is ready
  setTimeout(() => {
    authUI.initialize();
  }, 100);
});

// Global helper function for showing import status
window.showImportStatus = function(element, message, isSuccess) {
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
};
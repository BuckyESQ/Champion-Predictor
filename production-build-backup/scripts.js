// Consolidated scripts for ZED Champions Tracker

// Prevent duplicate definitions
if (!window.zedAuth) {
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
    
    // API Methods
    async testConnection() {
      try {
        if (!this.authManager.getToken()) {
          return { success: false, message: "No API token set. Please set your token first." };
        }
        
        if (this.authManager.isTokenExpired(this.authManager.getToken())) {
          return { success: false, message: "Your API token has expired. Please obtain a new token." };
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

  // Global objects
  window.zedAuth = new ZedAuthManager();
  window.zedApi = new ZedApiService(window.zedAuth);

  // Define ZED_API for backwards compatibility
  window.ZED_API = {
    authToken: window.zedAuth.getToken(),
    isTokenExpired: () => window.zedAuth.isTokenExpired(window.zedAuth.getToken()),
    testConnection: () => window.zedApi.testConnection(),
    fetchHorse: (id) => window.zedApi.fetchHorse(id),
    fetchAllHorses: (type) => window.zedApi.fetchAllHorses(type),
    showStatus: function(message, isSuccess, statusEl) {
      statusEl = statusEl || document.getElementById('test-api-connection-status');
      if (!statusEl) return;
      
      statusEl.style.display = 'block';
      statusEl.innerHTML = message;
      
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
  };
}

// Implement the missing onBloodlineChange function
window.onBloodlineChange = function(colorId, traitsId, attrsId) {
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
};

// Fix for showing import status messages
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
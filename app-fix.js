// Add this to a new file called app-fix.js
document.addEventListener('DOMContentLoaded', function() {
  console.log('Applying emergency fixes');
  
  // 1. Fix tab functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Store globally for other functions
  window.tabButtons = Array.from(tabButtons);
  window.tabContents = Array.from(tabContents);
  
  // Add click handlers to tab buttons
  tabButtons.forEach(button => {
    // Remove existing handlers first to prevent duplicates
    button.replaceWith(button.cloneNode(true));
  });
  
  // Re-select buttons after cloning
  const refreshedButtons = document.querySelectorAll('.tab-button');
  refreshedButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Activate the default tab or last active tab
  const lastActiveTab = localStorage.getItem('zedTrackerActiveTab') || 'racing';
  activateTab(lastActiveTab);
  
  // 2. Fix form handlers
  const addHorseForm = document.getElementById('add-horse-form');
  if (addHorseForm) {
    // Remove existing handlers
    const newForm = addHorseForm.cloneNode(true);
    addHorseForm.parentNode.replaceChild(newForm, addHorseForm);
    
    // Add handler
    newForm.addEventListener('submit', function(event) {
      event.preventDefault();
      window.handleAddHorse(event);
    });
  }
  
  // Reconnect other important form handlers...
  
  fixApiIntegration();
});

// Make activateTab globally accessible and keep it simple
window.activateTab = function(tabId) {
  console.log(`Activating tab: ${tabId}`);
  
  // Update buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-tab') === tabId);
  });
  
  // Update content divs
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-content-${tabId}`);
  });
  
  // Save active tab
  localStorage.setItem('zedTrackerActiveTab', tabId);
  
  // Special handlers for specific tabs
  if (tabId === 'analysis') {
    // Call analysis rendering functions if they exist
    if (typeof window.renderBloodlineAnalysis === 'function') {
      window.renderBloodlineAnalysis();
    }
    if (typeof window.renderIndividualAugmentAnalysis === 'function') {
      window.renderIndividualAugmentAnalysis();
    }
  }
};

// In app-fix.js, add:
function fixApiIntegration() {
  // Ensure there's only one implementation
  if (!window.zedApi) {
    console.error('ZED API not initialized properly');
    return;
  }
  
  // Fix any missing methods
  if (!window.zedApi.fetchHorseTypes) {
    window.zedApi.fetchHorseTypes = async function() {
      return {
        success: true,
        data: ['racing', 'breeding']
      };
    };
  }
  
  // Fix showImportStatus function
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
}
// Tab functionality fix
document.addEventListener('DOMContentLoaded', function() {
  console.log("Applying tabs fix...");
  
  // Define tab structure
  const tabs = [
    { id: 'racing', label: 'Racing' },
    { id: 'breeding', label: 'Breeding' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'augments', label: 'Augments' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'stats', label: 'Stats' },
    { id: 'import', label: 'Import' }
  ];
  
  // Get the tab container
  const tabButtonContainer = document.getElementById('tab-buttons');
  if (!tabButtonContainer) {
    console.error("Tab button container not found");
    return;
  }
  
  // Clear any existing tabs to prevent duplicates
  tabButtonContainer.innerHTML = '';
  
  // Create tab buttons
  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.setAttribute('data-tab', tab.id);
    button.textContent = tab.label;
    tabButtonContainer.appendChild(button);
  });
  
  // Add click handlers to buttons
  const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Make sure we have the activateTab function in global scope
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
    if (tabId === 'analysis') {
      if (typeof window.renderBloodlineAnalysis === 'function') {
        window.renderBloodlineAnalysis();
      }
      if (typeof window.renderIndividualAugmentAnalysis === 'function') {
        window.renderIndividualAugmentAnalysis();
      }
    }
  };
  
  // Activate the last active tab or default to racing
  const lastActiveTab = localStorage.getItem('zedTrackerActiveTab') || 'racing';
  activateTab(lastActiveTab);
});

// Make sure we have a global window.showConnectionStatus function
if (!window.showConnectionStatus) {
  window.showConnectionStatus = function(message, isSuccess) {
    const statusEl = document.getElementById('api-connection-status');
    if (!statusEl) return;
    
    statusEl.style.display = 'block';
    statusEl.textContent = message;
    
    if (isSuccess === true) {
      statusEl.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      statusEl.style.color = '#4CAF50';
    } else if (isSuccess === false) {
      statusEl.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
      statusEl.style.color = '#F44336';
    } else {
      statusEl.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
      statusEl.style.color = '#2196F3';
    }
  };
}
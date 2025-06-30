document.addEventListener('DOMContentLoaded', function() {
  console.log("Initializing tabs...");
  
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
      window.activateTab(tabId);
    });
  });
  
  // Load the last active tab
  const lastActiveTab = localStorage.getItem('zedTrackerActiveTab') || 'racing';
  window.activateTab(lastActiveTab);
});
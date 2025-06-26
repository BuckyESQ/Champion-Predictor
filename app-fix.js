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
document.addEventListener('DOMContentLoaded', function() {
  // Set up API token form
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
          window.showImportStatus(
            document.getElementById('test-api-connection-status'),
            'Token saved successfully!', 
            true
          );
        } else {
          window.showImportStatus(
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
      window.showImportStatus(statusEl, 'Testing connection...', null);
      try {
        const result = await window.zedApi.testConnection();
        window.showImportStatus(statusEl, result.message, result.success);
      } catch (error) {
        window.showImportStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
  
    if (importRacingBtn) {
      importRacingBtn.addEventListener('click', async function() {
        const statusEl = document.getElementById('import-status');
        if (!window.zedAuth.getToken()) {
          window.showImportStatus(statusEl, 'No API token set. Please set your token first.', false);
          return;
        }
      });
    }
  });
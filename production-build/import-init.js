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
  }
  
  if (importBreedingBtn) {
    importBreedingBtn.addEventListener('click', async function() {
      const statusEl = document.getElementById('import-status');
      if (!window.zedAuth.getToken()) {
        window.showImportStatus(statusEl, 'No API token set. Please set your token first.', false);
        return;
      }
      
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
  }
  
  if (importSingleBtn) {
    importSingleBtn.addEventListener('click', async function() {
      const horseId = document.getElementById('zed-horse-id').value.trim();
      const importType = document.getElementById('import-horse-type').value || 'racing';
      const statusEl = document.getElementById('single-import-status');
      
      if (!horseId) {
        window.showImportStatus(statusEl, "Please enter a horse ID", false);
        return;
      }
      
      if (!window.zedAuth.getToken()) {
        window.showImportStatus(statusEl, "No API token set. Please set your token first.", false);
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
      } catch (error) {
        console.error("Error importing single horse:", error);
        window.showImportStatus(statusEl, `Error: ${error.message}`, false);
      }
    });
  }
});
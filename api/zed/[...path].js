const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  try {
    // Get path from query
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Clean up the path for horse IDs
    let cleanPath = apiPath;
    
    // Improved horse ID handling based on ZedSight's approach
    if (cleanPath.includes('horse/')) {
      const parts = cleanPath.split('horse/');
      const horseId = parts[parts.length - 1].split('/')[0].trim();
      cleanPath = `horses/${horseId}`;
    } else if (cleanPath.startsWith('horses/https://')) {
      const urlParts = cleanPath.split('horses/https://app.zedchampions.com/horse/');
      if (urlParts.length > 1) {
        const horseId = urlParts[1].split('/')[0].trim();
        cleanPath = `horses/${horseId}`;
      }
    }
    
    console.log(`Original path: ${apiPath}`);
    console.log(`Cleaned path: ${cleanPath}`);
    
    const apiUrl = `https://api.zedchampions.com/v1/${cleanPath}`;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Prepare headers for the ZED API request
    const headers = { 'Content-Type': 'application/json' };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    
    try {
      // Use node-fetch or https module
      // For https module:
      return new Promise((resolve) => {
        const parsedUrl = new URL(apiUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: req.method,
          headers: headers
        };
        
        const proxyReq = https.request(options, (proxyRes) => {
          let responseBody = '';
          
          proxyRes.on('data', (chunk) => {
            responseBody += chunk;
          });
          
          proxyRes.on('end', () => {
            // Try to parse JSON response
            try {
              if (responseBody) {
                const jsonResponse = JSON.parse(responseBody);
                res.status(proxyRes.statusCode).json(jsonResponse);
              } else {
                res.status(proxyRes.statusCode).json({});
              }
            } catch (err) {
              // If not valid JSON, return as text
              res.status(proxyRes.statusCode).send(responseBody || 'No response data');
            }
            resolve();
          });
        });
        
        proxyReq.on('error', (error) => {
          console.error('API proxy error:', error);
          res.status(500).json({ 
            error: error.message,
            detail: "Error connecting to ZED Champions API"
          });
          resolve();
        });
        
        // Add body for POST/PUT/PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
          const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          proxyReq.write(bodyData);
        }
        
        proxyReq.end();
      });
    } catch (error) {
      res.status(500).json({ 
        error: error.message,
        detail: "Error in API proxy" 
      });
    }
  } catch (error) {
    console.error('Unexpected error in API proxy:', error);
    res.status(500).json({ 
      error: error.message,
      detail: "Unexpected error in API proxy"
    });
  }
};

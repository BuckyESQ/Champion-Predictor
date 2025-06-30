const https = require('https');

module.exports = async (req, res) => {
  try {
    // Get path from query
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Clean up the path for horse IDs
    let cleanPath = apiPath;
    
    // Handle different formats of horse IDs
    if (cleanPath.includes('horse/')) {
      // Extract ID from URL path
      const parts = cleanPath.split('horse/');
      const horseId = parts[parts.length - 1].split('/')[0].trim();
      cleanPath = `horses/${horseId}`;
    } else if (cleanPath.startsWith('horses/https://')) {
      // Handle malformed URL
      const urlParts = cleanPath.split('horses/https://app.zedchampions.com/horse/');
      if (urlParts.length > 1) {
        const horseId = urlParts[1].split('/')[0].trim();
        cleanPath = `horses/${horseId}`;
      }
    }
    
    console.log(`Original path: ${apiPath}`);
    console.log(`Cleaned path: ${cleanPath}`);
    
    const apiUrl = `https://api.zedchampions.com/v1/${cleanPath}`;
    console.log(`Proxying request to: ${apiUrl}`);
    
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
      console.log('Authorization header present');
      headers.Authorization = req.headers.authorization;
    } else {
      console.log('No authorization header');
    }
    
    // Parse the URL
    const parsedUrl = new URL(apiUrl);
    
    // Log the request details
    console.log(`Making request: ${req.method} ${parsedUrl.hostname}${parsedUrl.pathname}`);
    
    // Configure request options
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: req.method,
      headers: headers
    };
    
    // Return promise for async handling
    return new Promise((resolve) => {
      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';
        
        console.log(`Response status: ${proxyRes.statusCode}`);
        
        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        proxyRes.on('end', () => {
          // Try to parse JSON response, send as text if not valid JSON
          try {
            if (responseBody) {
              const jsonResponse = JSON.parse(responseBody);
              console.log('Successfully parsed JSON response');
              res.status(proxyRes.statusCode).json(jsonResponse);
            } else {
              console.log('Empty response body');
              res.status(proxyRes.statusCode).json({});
            }
          } catch (err) {
            console.log(`Error parsing JSON response: ${err.message}`);
            console.log(`Response body (first 100 chars): ${responseBody.substring(0, 100)}`);
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
        try {
          const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          proxyReq.write(bodyData);
        } catch (e) {
          console.error('Error writing request body:', e);
        }
      }
      
      proxyReq.end();
    });
  } catch (error) {
    console.error('Unexpected error in API proxy:', error);
    res.status(500).json({ 
      error: error.message,
      detail: "Unexpected error in API proxy"
    });
  }
};

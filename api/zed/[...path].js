const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  try {
    // Get path from query
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Clean up the path - remove any full URLs that might have been passed
    let cleanPath = apiPath;
    if (cleanPath.includes('https://app.zedchampions.com/horse/')) {
      // Extract just the horse ID from the URL
      cleanPath = 'horses/' + cleanPath.split('horse/')[1];
    }
    
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
      headers['Authorization'] = req.headers.authorization;
    }
    
    // Parse the URL
    const parsedUrl = new URL(apiUrl);
    
    // Configure request options
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: req.method,
      headers: headers
    };
    
    console.log(`Making request with options:`, JSON.stringify(options));
    
    // Return promise for async handling
    return new Promise((resolve) => {
      const proxyReq = https.request(options, (proxyRes) => {
        let responseBody = '';
        
        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        proxyRes.on('end', () => {
          console.log(`Response status: ${proxyRes.statusCode}`);
          
          // Try to parse JSON response, send as text if not valid JSON
          try {
            const jsonResponse = JSON.parse(responseBody);
            res.status(proxyRes.statusCode).json(jsonResponse);
          } catch (err) {
            console.log(`Error parsing JSON response: ${err.message}`);
            console.log(`Response body: ${responseBody.substring(0, 100)}...`);
            res.status(proxyRes.statusCode).send(responseBody);
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

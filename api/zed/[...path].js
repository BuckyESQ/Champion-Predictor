const https = require('https');

module.exports = async (req, res) => {
  try {
    // Log to help debug
    console.log('API proxy received request:', req.url, req.method);
    
    // Get path from query
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Final API URL
    const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
    console.log('Proxying to ZED Champions API:', apiUrl);
    
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
    const headers = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    
    // Make the request to the ZED Champions API
    return new Promise((resolve) => {
      const proxyReq = https.request(apiUrl, {
        method: req.method,
        headers: headers
      }, (proxyRes) => {
        let responseBody = '';
        
        proxyRes.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        proxyRes.on('end', () => {
          try {
            // Try to parse as JSON
            if (responseBody && responseBody.trim()) {
              try {
                const jsonResponse = JSON.parse(responseBody);
                res.status(proxyRes.statusCode).json(jsonResponse);
              } catch (parseError) {
                res.status(proxyRes.statusCode).send(responseBody);
              }
            } else {
              res.status(proxyRes.statusCode).json({});
            }
          } catch (err) {
            res.status(500).json({ error: 'Error processing API response' });
          }
          resolve();
        });
      });
      
      proxyReq.on('error', (error) => {
        res.status(500).json({ 
          error: error.message,
          detail: "Error connecting to ZED Champions API"
        });
        resolve();
      });
      
      // Add body for non-GET requests
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        try {
          const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          proxyReq.write(bodyData);
        } catch (e) {
          console.error('Error writing request body:', e);
        }
      }
      
      // End the request
      proxyReq.end();
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      detail: "Unexpected error in API proxy"
    });
  }
};

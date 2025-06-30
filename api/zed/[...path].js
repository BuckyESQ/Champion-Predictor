const https = require('https');

module.exports = async (req, res) => {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
  
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
  
  return new Promise((resolve) => {
    // Create options for the HTTPS request
    const urlObj = new URL(apiUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: req.method,
      headers: headers
    };
    
    const proxyReq = https.request(options, (proxyRes) => {
      let responseBody = '';
      
      proxyRes.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      proxyRes.on('end', () => {
        // Try to parse JSON response, send as text if not valid JSON
        try {
          const jsonResponse = JSON.parse(responseBody);
          res.status(proxyRes.statusCode).json(jsonResponse);
        } catch (err) {
          res.status(proxyRes.statusCode).send(responseBody);
        }
        resolve();
      });
    });
    
    proxyReq.on('error', (error) => {
      console.error('API proxy error:', error);
      res.status(500).json({ 
        error: error.message,
        detail: "Error in API proxy" 
      });
      resolve();
    });
    
    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      proxyReq.write(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    }
    
    proxyReq.end();
  });
};

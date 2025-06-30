const https = require('https');
const url = require('url');

module.exports = async (req, res) => {
  // Extract the path from the URL
  const urlPath = req.url || '';
  const segments = urlPath.split('/');
  // Remove 'api', 'zed' and any empty segments
  const pathSegments = segments.filter(s => s && s !== 'api' && s !== 'zed');
  const apiPath = pathSegments.join('/');
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Clean up horse IDs from URLs
  let cleanApiPath = apiPath;
  if (cleanApiPath.startsWith('horses/') && cleanApiPath.includes('app.zedchampions.com/horse/')) {
    const match = cleanApiPath.match(/horses\/.*\/horse\/([^\/]+)/);
    if (match && match[1]) {
      cleanApiPath = `horses/${match[1]}`;
    }
  }

  const apiUrl = `https://api.zedchampions.com/v1/${cleanApiPath}`;
  
  // Forward the request to the ZED Champions API
  return new Promise((resolve) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    
    const options = {
      method: req.method,
      headers: headers
    };
    
    const proxyReq = https.request(apiUrl, options, (proxyRes) => {
      let data = '';
      
      proxyRes.on('data', (chunk) => {
        data += chunk;
      });
      
      proxyRes.on('end', () => {
        try {
          // Try to parse as JSON
          const jsonData = JSON.parse(data);
          res.status(proxyRes.statusCode).json(jsonData);
        } catch (e) {
          // Return as plain text if not valid JSON
          res.status(proxyRes.statusCode).send(data);
        }
        resolve();
      });
    });
    
    proxyReq.on('error', (error) => {
      res.status(500).json({
        error: error.message,
        url: apiUrl
      });
      resolve();
    });
    
    // Add body for non-GET requests
    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.write(bodyData);
    }
    
    proxyReq.end();
  });
};

const https = require('https');

module.exports = async (req, res) => {
  try {
    // Log to help debug
    console.log('API proxy received request:', req.url, req.method);
    
    // Get path from query
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path;
    
    // Clean up the path for horse IDs
    let cleanPath = apiPath;
    
    // Handle URL encoded slashes
    cleanPath = cleanPath.replace(/%2F/g, '/');
    
    // Handle different horse ID formats
    if (cleanPath.includes('horse/')) {
      const parts = cleanPath.split('horse/');
      const horseId = parts[parts.length - 1].split('/')[0].trim();
      cleanPath = `horses/${horseId}`;
    } else if (cleanPath.includes('horses/http')) {
      // Extract just the ID from URLs like horses/https://app.zedchampions.com/horse/ID
      const match = cleanPath.match(/horses\/https?:\/\/[^\/]+\/horse\/([^\/\?]+)/i);
      if (match && match[1]) {
        cleanPath = `horses/${match[1]}`;
      }
    }
    
    // Final API URL
    const apiUrl = `https://api.zedchampions.com/v1/${cleanPath}`;
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
      console.log('Authorization header forwarded');
    } else {
      console.log('No authorization header found in request');
    }
    
    // Make the request to the ZED Champions API
    return new Promise((resolve) => {
      try {
        // Parse the URL
        const parsedUrl = new URL(apiUrl);
        
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: req.method,
          headers: headers
        };
        
        console.log('Making request with options:', JSON.stringify(options));
        
        const proxyReq = https.request(options, (proxyRes) => {
          console.log('Received response with status:', proxyRes.statusCode);
          
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
                  console.log('Error parsing response as JSON:', parseError.message);
                  console.log('Response body (truncated):', responseBody.substring(0, 200));
                  res.status(proxyRes.statusCode).send(responseBody);
                }
              } else {
                console.log('Empty response body');
                res.status(proxyRes.statusCode).json({});
              }
            } catch (err) {
              console.error('Error handling response:', err);
              res.status(500).json({ error: 'Error processing API response' });
            }
            resolve();
          });
        });
        
        proxyReq.on('error', (error) => {
          console.error('API proxy request error:', error);
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
      } catch (error) {
        console.error('Error setting up proxy request:', error);
        res.status(500).json({ 
          error: error.message,
          detail: "Error setting up proxy request"
        });
        resolve();
      }
    });
  } catch (error) {
    console.error('Unexpected error in API proxy:', error);
    res.status(500).json({ 
      error: error.message,
      detail: "Unexpected error in API proxy"
    });
  }
};

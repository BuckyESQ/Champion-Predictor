export default async function handler(req, res) {
  // Extract path from request
  const path = req.query.path || [];
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Clean up horse IDs from URLs
    let cleanApiPath = apiPath;
    
    // Handle different horse ID formats
    if (cleanApiPath.includes('horse/')) {
      const parts = cleanApiPath.split('horse/');
      const horseId = parts[parts.length - 1].split('/')[0].trim();
      cleanApiPath = `horses/${horseId}`;
    } else if (cleanApiPath.includes('horses/http')) {
      const match = cleanApiPath.match(/horses\/.*\/horse\/([^\/]+)/i);
      if (match && match[1]) {
        cleanApiPath = `horses/${match[1]}`;
      }
    }

    const apiUrl = `https://api.zedchampions.com/v1/${cleanApiPath}`;
    console.log(`Proxying request to ZED API: ${apiUrl}`);
    
    // Headers for the ZED API request
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Forward authorization header if present
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
      console.log('Authorization header forwarded');
    }

    // Make the request to ZED API
    const response = await fetch(apiUrl, {
      method: req.method,
      headers: headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body ? 
        JSON.stringify(req.body) : undefined
    });

    // Get response data
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json({ 
      error: error.message,
      detail: "Error connecting to ZED Champions API"
    });
  }
}

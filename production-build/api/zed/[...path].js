export default async function handler(req, res) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
  
  console.log(`Proxying request to: ${apiUrl}`);
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Forward authorization header if present
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body 
        ? JSON.stringify(req.body) 
        : undefined
    });
    
    const data = await response.json();
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json({ 
      error: error.message,
      detail: "Error in API proxy"
    });
  }
}
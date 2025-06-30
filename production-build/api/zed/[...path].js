export default async function handler(req, res) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
  
  console.log(`Proxying request to: ${apiUrl}`);
  console.log(`Method: ${req.method}`);
  
  // Add CORS headers for OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    return res.status(200).end();
  }
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Forward authorization header if present
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  
  try {
    const fetchOptions = {
      method: req.method,
      headers: headers
    };
    
    // Add body for non-GET methods
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(apiUrl, fetchOptions);
    
    // Get the content type to determine how to process the response
    const contentType = response.headers.get('content-type');
    
    // Parse response appropriately
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    
    // Forward content type if it exists
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    return res.status(response.status).json(
      typeof data === 'object' ? data : { text: data }
    );
  } catch (error) {
    console.error('API proxy error:', error);
    return res.status(500).json({ 
      error: error.message,
      detail: "Error in API proxy"
    });
  }
}

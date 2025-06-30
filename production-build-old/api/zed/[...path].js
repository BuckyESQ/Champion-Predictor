export default async function handler(req, res) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
  
  // Log the request for debugging
  console.log(`Proxy request to: ${apiUrl}`);
  console.log(`Method: ${req.method}`);
  
  let requestHeaders = {
    'Content-Type': 'application/json'
  };
  
  // Forward authorization header if present
  if (req.headers.authorization) {
    requestHeaders.Authorization = req.headers.authorization;
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    // Get response data
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    // Send response back to client
    const statusCode = response.status;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // Send the response
    return res.status(statusCode).json(typeof data === 'object' ? data : { data });
    
  } catch (error) {
    console.error(`API proxy error:`, error);
    return res.status(500).json({
      error: error.message,
      detail: "Error in API proxy"
    });
  }
}
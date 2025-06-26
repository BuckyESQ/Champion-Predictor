// This is the server-side proxy endpoint that should be deployed on Vercel
// filepath: /workspaces/Champion-Predictor/api/zed/[...path].js
export default async function handler(req, res) {
  const { path } = req.query;
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const apiUrl = `https://api.zedchampions.com/v1/${apiPath}`;
  
  console.log(`Proxying request to: ${apiUrl}`);
  
  try {
    const response = await fetch(apiUrl, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' 
        ? JSON.stringify(req.body) 
        : undefined
    });
    
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error(`Proxy error for ${apiPath}:`, error);
    return res.status(500).json({ 
      error: error.message,
      detail: "Error in API proxy" 
    });
  }
}
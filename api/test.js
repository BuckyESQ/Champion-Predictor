export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "API test endpoint working!",
    path: req.url,
    query: req.query,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}
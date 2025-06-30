module.exports = (req, res) => {
  res.json({
    success: true,
    message: "API test endpoint is working!",
    timestamp: new Date().toISOString(),
    method: req.method,
    query: req.query,
    path: req.url,
    headers: req.headers
  });
};
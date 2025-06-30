module.exports = (req, res) => {
  res.json({
    success: true,
    message: "API test endpoint is working!",
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers
  });
};
module.exports = (req, res) => {
  res.status(200).json({
    success: true,
    message: "API test endpoint working!",
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};
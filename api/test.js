module.exports = (req, res) => {
  res.json({
    success: true,
    message: "API test endpoint is working!",
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers
  });

  // Test with your actual token
  fetch('https://api.zedchampions.com/v1/me', {
    headers: {
      'Authorization': 'Bearer your-token-here'
    }
  })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
};
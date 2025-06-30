module.exports = (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is working!',
    time: new Date().toISOString(),
    query: req.query,
    method: req.method,
    headers: req.headers
  });
};
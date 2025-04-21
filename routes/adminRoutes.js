const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Admin authentication middleware
const authAdmin = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: "Not authorized as admin" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

// YouTube OAuth callback route
router.get('/youtube-callback', (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('No authorization code provided');
  }
  
  // Store the code in session for later use
  req.session.youtubeAuthCode = code;
  
  res.send('Authorization successful! You can close this window.');
});

// Export the router (this is the critical part)
module.exports = router;
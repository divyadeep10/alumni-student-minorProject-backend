const jwt = require('jsonwebtoken');
const Alumni = require('../models/Alumni'); // Alumni model
const Student = require('../models/Student'); // Student model

const authMiddleware = async (req, res, next) => {
  try {
      console.log('Auth Middleware:', req.header('Authorization'));
      const token = req.header('Authorization')?.split(' ')[1];
      console.log('JWT_SECRET:', process.env.JWT_SECRET);
      console.log('Token:', token);
      
      if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded:', decoded);

      // Correcting ID reference
      console.log('Searching for user with ID:', decoded.userId);
      let user = await Alumni.findById(decoded.userId).select('-password');
      let userModel = 'Alumni';

      if (!user) {
          user = await Student.findById(decoded.userId).select('-password');
          userModel = 'Student';
      }

      console.log('User:', user, 'User Model:', userModel);

      if (!user) return res.status(404).json({ error: 'User not found' });

      req.user = user;
      req.userModel = userModel;

      next();
  } catch (error) {
      console.error('Auth Error:', error);
      res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;

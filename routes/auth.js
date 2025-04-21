// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Models
const Student = require('../models/Student');
const Alumni = require('../models/Alumni');

// Use environment variable for JWT secret

console.log(process.env.JWT_SECRET);

// Student Registration
router.post('/register/student', async (req, res) => {
  try {
    const { name, email, collegeId, interests, careerGoals, password } = req.body;
    let student = await Student.findOne({ email });
    if (student) {
      return res.status(400).json({ message: "Student already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    student = new Student({
      name,
      email,
      collegeId,
      interests,
      careerGoals,
      password: hashedPassword
    });
    await student.save();
    res.status(201).json({ message: "Student registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Alumni Registration
router.post('/register/alumni', async (req, res) => {
  try {
    const { name, email, collegeId, careerInsights, password } = req.body;
    let alumni = await Alumni.findOne({ email });
    if (alumni) {
      return res.status(400).json({ message: "Alumni already registered" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    alumni = new Alumni({
      name,
      email,
      collegeId,
      careerInsights,
      password: hashedPassword
    });
    await alumni.save();
    res.status(201).json({ message: "Alumni registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add this after your existing registration routes
// Admin Registration
router.post('/register/admin', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    console.log("Registering admin with email:", email);
    
    // Check if admin already exists
    const existingAdmin = await Alumni.findOne({ email });
    if (existingAdmin) {
      console.log("Admin already exists:", existingAdmin);
      
      // If the user exists but isn't an admin, update them to be an admin
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        return res.status(200).json({ 
          message: "Existing user updated to admin",
          adminId: existingAdmin._id,
          email: existingAdmin.email
        });
      }
      
      return res.status(400).json({ message: "Admin already exists with this email" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create admin as a special type of Alumni with explicit isAdmin field
    const admin = new Alumni({
      name,
      email,
      collegeId: 'ADMIN',
      careerInsights: 'Platform Administrator',
      password: hashedPassword,
      isAdmin: true
    });
    
    console.log("Saving admin with isAdmin:", admin.isAdmin);
    
    const savedAdmin = await admin.save();
    console.log("Admin saved:", savedAdmin);
    
    // Return more details for debugging
    res.status(201).json({ 
      message: "Admin registered successfully",
      adminId: savedAdmin._id,
      email: savedAdmin.email,
      isAdmin: savedAdmin.isAdmin
    });
  } catch (err) {
    console.error("Admin registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Modify your login route to handle admin login
// Login route with fixed payload declaration
// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Handle admin login
    if (role === 'admin') {
      console.log("Admin login attempt for:", email);
      
      const admin = await Alumni.findOne({ email, isAdmin: true });
      if (!admin) {
        console.log("Admin not found with email:", email);
        return res.status(400).json({ message: "Invalid credentials" });
      }
      
      console.log("Admin found, checking password");
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        console.log("Password doesn't match");
        return res.status(400).json({ message: "Invalid credentials" });
      }
      
      const payload = {
        userId: admin._id,
        role: 'admin',
        isAdmin: true
      };
      
      jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) throw err;
        res.json({ token, userId: admin._id, role: 'admin' });
      });
      
      return;
    }
    
    // Handle student/alumni login
    let user;
    if (role === 'student') {
      user = await Student.findOne({ email });
    } else if (role === 'alumni') {
      user = await Alumni.findOne({ email });
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }
    
    const payload = { userId: user._id, role: role };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      res.json({ token, message: "Login successful" });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add this temporary route for debugging
router.get('/check-admin/:email', async (req, res) => {
  try {
    const admin = await Alumni.findOne({ 
      email: req.params.email
    });
    
    if (admin) {
      res.json({ 
        found: true, 
        id: admin._id,
        email: admin.email,
        isAdmin: admin.isAdmin || false,
        collegeId: admin.collegeId
      });
    } else {
      res.json({ found: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add this temporary update route
router.post('/update-admin/:email', async (req, res) => {
  try {
    const admin = await Alumni.findOne({ email: req.params.email });
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.isAdmin = true;
    await admin.save();

    res.json({ 
      message: "Admin updated successfully",
      id: admin._id,
      email: admin.email,
      isAdmin: admin.isAdmin
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add this test route for OAuth configuration
router.get('/test-oauth-config', async (req, res) => {
  try {
    // Check if required OAuth credentials exist
    const oauthConfig = {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      redirectUri: process.env.YOUTUBE_REDIRECT_URI
    };
    
    // Verify all required credentials are present
    const missingCreds = Object.entries(oauthConfig)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingCreds.length > 0) {
      return res.status(400).json({
        message: "Missing OAuth credentials",
        missingFields: missingCreds
      });
    }
    
    res.json({
      message: "OAuth configuration present",
      clientId: oauthConfig.clientId.substring(0, 8) + '...',
      redirectUri: oauthConfig.redirectUri
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;

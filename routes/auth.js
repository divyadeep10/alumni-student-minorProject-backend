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

// Login route for both roles
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body; // role: 'student' or 'alumni'
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

module.exports = router;

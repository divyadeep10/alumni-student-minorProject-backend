// routes/student.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Webinar = require('../models/Webinar');
const Student = require('../models/Student');
const Alumni = require('../models/Alumni');
const Mentorship = require('../models/Mentorship');

// const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to verify token and ensure the user is a student
const authStudent = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'student')
      return res.status(403).json({ message: "Access denied" });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

router.get('/getter/webinars', authStudent, async (req, res) => {
  try {
    const studentId = req.user.userId;

    // 🔹 Find alumni who have this student in their connections
    const connectedAlumni = await Alumni.find({ connections: studentId }).select("_id");
    const alumniIds = connectedAlumni.map(alumni => alumni._id);

    console.log("Connected Alumni IDs:", alumniIds); // Debugging log

    // 🔹 Fetch webinars only from connected alumni
    const webinars = await Webinar.find({ host: { $in: alumniIds } }).populate("host", "name email");

    res.json(webinars);
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Student Dashboard (protected)
router.get('/dashboard', authStudent, async (req, res) => {
  try {
    const student = await Student.findById(req.user.userId).populate('connections');
    res.json({ student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Send mentorship request to an alumni
router.post('/request-mentor', authStudent, async (req, res) => {
  try {
    const { alumniId } = req.body;
    
    // Validate alumniId is provided
    if (!alumniId) {
      return res.status(400).json({ message: "Alumni ID is required" });
    }

    // Check if alumni exists
    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }

    // Check if a request already exists
    const existingRequest = await Mentorship.findOne({
      student: req.user.userId,
      alumni: alumniId
    });

    // If request exists and is rejected, allow sending a new request
    if (existingRequest && existingRequest.status === 'rejected') {
      // Update the existing request to pending
      existingRequest.status = 'pending';
      existingRequest.requestedAt = Date.now(); // Reset the request time
      await existingRequest.save();
      
      return res.json({ 
        message: "Mentorship request sent successfully",
        status: 'pending'
      });
    }

    // If request exists and is not rejected, return current status
    if (existingRequest) {
      return res.status(400).json({ 
        message: "A mentorship request already exists with this alumni",
        status: existingRequest.status
      });
    }

    // Create new mentorship request
    const request = new Mentorship({
      student: req.user.userId,
      alumni: alumniId,
      status: 'pending'
    });
    
    await request.save();
    res.json({ 
      message: "Mentorship request sent successfully",
      status: 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get saved alumni connections
router.get('/connections', authStudent, async (req, res) => {
  try {
    const student = await Student.findById(req.user.userId)
      .populate({
        path: 'connections',
        select: 'name email collegeId careerInsights expertiseAreas industryExperience mentorStyle'
      });
    
    // Format the connections data for better frontend display
    const formattedConnections = student.connections.map(alumni => ({
      id: alumni._id,
      name: alumni.name,
      email: alumni.email,
      collegeId: alumni.collegeId,
      careerInsights: alumni.careerInsights,
      expertiseAreas: alumni.expertiseAreas ? Object.fromEntries(alumni.expertiseAreas) : {},
      industryExperience: alumni.industryExperience || [],
      mentorStyle: alumni.mentorStyle
    }));
    
    res.json({ 
      connections: formattedConnections,
      totalConnections: formattedConnections.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// View profile of a specific alumni connection
router.get('/profile/:alumniId', authStudent, async (req, res) => {
  try {
    const alumniId = req.params.alumniId;
    
    // Check if this alumni is in the student's connections
    const student = await Student.findById(req.user.userId);
    const isConnected = student.connections.includes(alumniId);
    
    // Get the alumni details
    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }
    
    // Format the alumni data
    const alumniData = {
      id: alumni._id,
      name: alumni.name,
      email: alumni.email,
      collegeId: alumni.collegeId,
      careerInsights: alumni.careerInsights,
      expertiseAreas: alumni.expertiseAreas ? Object.fromEntries(alumni.expertiseAreas) : {},
      industryExperience: alumni.industryExperience || [],
      mentorStyle: alumni.mentorStyle,
      availability: alumni.availability || [],
      communicationPreference: alumni.communicationPreference,
      isConnected: isConnected
    };
    
    res.json({ alumni: alumniData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get connection statistics
router.get('/connection-stats', authStudent, async (req, res) => {
  try {
    const student = await Student.findById(req.user.userId);
    
    // Get all connections with their expertise areas
    const connections = await Alumni.find({
      _id: { $in: student.connections }
    }).select('expertiseAreas mentorStyle');
    
    // Count expertise areas across all connections
    const expertiseCounts = {};
    connections.forEach(alumni => {
      if (alumni.expertiseAreas) {
        for (const [area, _] of alumni.expertiseAreas) {
          expertiseCounts[area] = (expertiseCounts[area] || 0) + 1;
        }
      }
    });
    
    // Count mentor styles
    const mentorStyleCounts = {};
    connections.forEach(alumni => {
      if (alumni.mentorStyle) {
        mentorStyleCounts[alumni.mentorStyle] = (mentorStyleCounts[alumni.mentorStyle] || 0) + 1;
      }
    });
    
    res.json({
      totalConnections: student.connections.length,
      expertiseBreakdown: expertiseCounts,
      mentorStyleBreakdown: mentorStyleCounts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get dashboard statistics for student
router.get('/dashboard-stats', authStudent, async (req, res) => {
  try {
    const studentId = req.user.userId;
    
    // Get pending mentorship requests
    const pendingRequests = await Mentorship.countDocuments({
      student: studentId,
      status: 'pending'
    });
    
    // Get active connections (accepted mentorships)
    const student = await Student.findById(studentId);
    const activeConnections = student.connections.length;
    
    // Get upcoming webinars from connected alumni
    const connectedAlumni = await Alumni.find({ connections: studentId }).select("_id");
    const alumniIds = connectedAlumni.map(alumni => alumni._id);
    
    const now = new Date();
    const upcomingWebinars = await Webinar.countDocuments({
      host: { $in: alumniIds },
      scheduledAt: { $gt: now }
    });
    
    // For unread messages - this is a placeholder since we don't have a message system yet
    // You can implement this when you add messaging functionality
    const unreadMessages = 0;
    
    res.json({
      pendingRequests,
      activeConnections,
      upcomingWebinars,
      unreadMessages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// View mentor profile (only connected mentors)
router.get('/view-mentor/:mentorId', authStudent, async (req, res) => {
  try {
    const studentId = req.user.userId;
    const mentorId = req.params.mentorId;
    
    // Verify the student has a connection with this mentor
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Check if the mentor is in the student's connections
    if (!student.connections.includes(mentorId)) {
      return res.status(403).json({ 
        message: "Access denied. You can only view profiles of your connected mentors." 
      });
    }
    
    // Fetch mentor details
    const mentor = await Alumni.findById(mentorId)
      .select('-password -mentees -connections -__v');
    
    if (!mentor) {
      return res.status(404).json({ message: "Mentor not found" });
    }
    
    // Get active mentorship status
    const mentorship = await Mentorship.findOne({
      student: studentId,
      alumni: mentorId,
      status: 'accepted'
    });
    
    // Return mentor profile with mentorship details
    res.json({
      mentor,
      mentorshipDetails: mentorship ? {
        since: mentorship.requestedAt,
        duration: Math.floor((Date.now() - new Date(mentorship.requestedAt).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
      } : null
    });
    
  } catch (err) {
    console.error("Error viewing mentor profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// View all connected mentors with basic info
router.get('/my-mentors', authStudent, async (req, res) => {
  try {
    const studentId = req.user.userId;
    
    // Find the student and populate connections with limited fields
    const student = await Student.findById(studentId)
      .populate('connections', 'name email industryExperience expertiseAreas mentorStyle');
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    res.json({ mentors: student.connections });
    
  } catch (err) {
    console.error("Error fetching mentors:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add a new endpoint to check mentorship request status
router.get('/request-status/:alumniId', authStudent, async (req, res) => {
  try {
    const alumniId = req.params.alumniId;
    const studentId = req.user.userId;
    
    // Find the request
    const request = await Mentorship.findOne({
      student: studentId,
      alumni: alumniId
    });
    
    if (!request) {
      return res.json({ status: 'none' }); // No request exists
    }
    
    res.json({ 
      status: request.status,
      requestedAt: request.requestedAt
    });
  } catch (err) {
    console.error("Error checking request status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

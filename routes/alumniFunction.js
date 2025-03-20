// routes/alumni.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const Alumni = require('../models/Alumni');
const Student = require('../models/Student');
const Mentorship = require('../models/Mentorship');
const Webinar = require('../models/Webinar');

// const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware to verify token and ensure the user is an alumni
const authAlumni = (req, res, next) => {
  const token = req.header('Authorization');
  console.log(token);
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    if (decoded.role !== 'alumni')
      return res.status(403).json({ message: "Access denied" });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Public: Get top alumni based on connections
router.get('/top-alumni', async (req, res) => {
  try {
    const allAlumni = await Alumni.find({});
    const sortedAlumni = allAlumni.sort((a, b) => b.connections.length - a.connections.length);
    const topAlumni = sortedAlumni.slice(0, 5).map(alumni => ({
      _id: alumni._id,
      name: alumni.name,
      email: alumni.email,
      collegeId: alumni.collegeId,
      careerInsights: alumni.careerInsights,
      // Convert Map to Object for proper JSON serialization
      expertiseAreas: alumni.expertiseAreas ? Object.fromEntries(alumni.expertiseAreas) : {},
      industryExperience: alumni.industryExperience || [],
      mentorStyle: alumni.mentorStyle,
      connections: alumni.connections
    }));
    res.json({ topAlumni });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/my-webinars', authAlumni, async (req, res) => {
  try {
    const webinars = await Webinar.find({ host: req.user.userId });
    res.json(webinars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Alumni Dashboard (protected)
router.get('/dashboard', authAlumni, async (req, res) => {
  try {
    const alumni = await Alumni.findById(req.user.userId)
      .populate('mentees')
      .populate('connections');
    res.json({ alumni });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// View pending student mentorship requests
router.get('/requests', authAlumni, async (req, res) => {
  try {
    const requests = await Mentorship.find({ alumni: req.user.userId, status: 'pending' })
      .populate('student');
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Accept a mentorship request
router.post('/accept-request', authAlumni, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await Mentorship.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    
    request.status = 'accepted';
    await request.save();
    
    const alumni = await Alumni.findById(req.user.userId);
    if (!alumni.connections.includes(request.student)) {
      alumni.connections.push(request.student);
      await alumni.save();
    }
    
    const student = await Student.findById(request.student);
    if (!student.connections.includes(req.user.userId)) {
      student.connections.push(req.user.userId);
      await student.save();
    }
    
    res.json({ message: "Request accepted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reject a mentorship request
router.post('/reject-request', authAlumni, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await Mentorship.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });
    
    // Update request status to rejected
    request.status = 'rejected';
    await request.save();
    
    res.json({ message: "Request rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Host a new webinar (updated to support on-site webinars)
router.post('/webinar', authAlumni, async (req, res) => {
  try {
    const { title, description, scheduledAt, videoLink, videoType, location } = req.body;

    // Create webinar object with common fields
    const webinarData = {
      title,
      description,
      host: req.user.userId,
      scheduledAt,
      videoType
    };

    // Add type-specific fields
    if (videoType === 'on-site') {
      if (!location || !location.venue) {
        return res.status(400).json({ message: "Location details are required for on-site webinars" });
      }
      webinarData.location = location;
      webinarData.isOnSite = true;
    } else {
      if (!videoLink) {
        return res.status(400).json({ message: "Video link is required for online webinars" });
      }
      webinarData.videoLink = videoLink;
    }

    const webinar = new Webinar(webinarData);
    await webinar.save();
    
    res.status(201).json({ 
      message: "Webinar scheduled successfully",
      webinar: {
        id: webinar._id,
        title: webinar.title,
        videoType: webinar.videoType,
        scheduledAt: webinar.scheduledAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/getter/webinars', authAlumni, async (req, res) => {
  try {
    const studentId = req.user.userId;
    
    // Find alumni who have this student in their connections
    const connectedAlumni = await Alumni.find({ connections: studentId }).select("_id");
    const alumniIds = connectedAlumni.map(alumni => alumni._id);

    // Fetch webinars only from connected alumni
    const webinars = await Webinar.find({ host: { $in: alumniIds } }).populate("host", "name email");

    res.json(webinars);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// New route: Update webinar video link and type
router.post('/webinar/:id/video', authAlumni, async (req, res) => {
  try {
    const webinarId = req.params.id;
    const { videoLink, videoType } = req.body; // videoType: 'live' or 'recorded'
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }
    webinar.videoLink = videoLink;
    webinar.videoType = videoType;
    await webinar.save();
    res.status(200).json({ message: "Webinar updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update alumni profile and career insights
router.put('/update-profile', authAlumni, async (req, res) => {
  try {
    const { name, careerInsights } = req.body;
    const alumni = await Alumni.findById(req.user.userId);
    if (name) alumni.name = name;
    if (careerInsights) alumni.careerInsights = careerInsights;
    await alumni.save();
    res.json({ message: "Profile updated successfully", alumni });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get dashboard statistics for alumni
router.get('/dashboard-stats', authAlumni, async (req, res) => {
  try {
    const alumniId = req.user.userId;
    
    // Get pending mentorship requests
    const pendingRequests = await Mentorship.countDocuments({
      alumni: alumniId,
      status: 'pending'
    });
    
    // Get active connections (students being mentored)
    const alumni = await Alumni.findById(alumniId);
    const activeConnections = alumni.connections.length;
    
    // Get upcoming webinars hosted by this alumni
    const now = new Date();
    const upcomingWebinars = await Webinar.countDocuments({
      host: alumniId,
      scheduledAt: { $gt: now }
    });
    
    // Get total attendees across all webinars
    const webinars = await Webinar.find({ host: alumniId });
    const totalAttendees = webinars.reduce((total, webinar) => {
      return total + (webinar.participants ? webinar.participants.length : 0);
    }, 0);
    
    // For unread messages - this is a placeholder since we don't have a message system yet
    const unreadMessages = 0;
    
    res.json({
      pendingRequests,
      activeConnections,
      upcomingWebinars,
      totalAttendees,
      unreadMessages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// View mentee profile (only connected mentees)
router.get('/view-mentee/:menteeId', authAlumni, async (req, res) => {
  try {
    const alumniId = req.user.userId;
    const menteeId = req.params.menteeId;
    
    // Verify the alumni has a connection with this mentee
    const alumni = await Alumni.findById(alumniId);
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }
    
    // Check if the mentee is in the alumni's connections
    if (!alumni.connections.includes(menteeId)) {
      return res.status(403).json({ 
        message: "Access denied. You can only view profiles of your connected mentees." 
      });
    }
    
    // Fetch mentee details
    const mentee = await Student.findById(menteeId)
      .select('-password -connections -__v');
    
    if (!mentee) {
      return res.status(404).json({ message: "Mentee not found" });
    }
    
    // Get active mentorship status
    const mentorship = await Mentorship.findOne({
      student: menteeId,
      alumni: alumniId,
      status: 'accepted'
    });
    
    // Return mentee profile with mentorship details
    res.json({
      mentee,
      mentorshipDetails: mentorship ? {
        since: mentorship.requestedAt,
        duration: Math.floor((Date.now() - new Date(mentorship.requestedAt).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
      } : null
    });
    
  } catch (err) {
    console.error("Error viewing mentee profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// View all connected mentees with basic info
router.get('/my-mentees', authAlumni, async (req, res) => {
  try {
    const alumniId = req.user.userId;
    
    // Find the alumni and populate connections with limited fields
    const alumni = await Alumni.findById(alumniId)
      .populate('connections', 'name email collegeId interests careerGoals learningStyle');
    
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }
    
    res.json({ mentees: alumni.connections });
    
  } catch (err) {
    console.error("Error fetching mentees:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get public profile of a specific alumni
router.get('/:alumniId', async (req, res) => {
  try {
    const alumniId = req.params.alumniId;
    
    // Get the alumni details with limited fields for public view
    const alumni = await Alumni.findById(alumniId)
      .select('name email collegeId careerInsights expertiseAreas industryExperience mentorStyle');
    
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }
    
    // Format the alumni data for response
    const alumniData = {
      id: alumni._id,
      name: alumni.name,
      email: alumni.email,
      collegeId: alumni.collegeId,
      careerInsights: alumni.careerInsights,
      // Convert Map to Object for proper JSON serialization
      expertiseAreas: alumni.expertiseAreas ? Object.fromEntries(alumni.expertiseAreas) : {},
      industryExperience: alumni.industryExperience || [],
      mentorStyle: alumni.mentorStyle
    };
    
    res.json(alumniData);
  } catch (err) {
    console.error("Error fetching alumni:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

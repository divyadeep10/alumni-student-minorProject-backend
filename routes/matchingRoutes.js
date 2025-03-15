const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Alumni = require('../models/Alumni');
const matchingService = require('../services/matchingService');

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

// Update student matching preferences
router.put('/preferences', authStudent, async (req, res) => {
  try {
    const { 
      detailedInterests, 
      learningStyle, 
      availability, 
      communicationPreference,
      matchingPreferences
    } = req.body;
    
    const student = await Student.findById(req.user.userId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Update fields if provided
    if (detailedInterests) {
      student.detailedInterests = new Map(Object.entries(detailedInterests));
    }
    
    if (learningStyle) {
      student.learningStyle = learningStyle;
    }
    
    if (availability) {
      student.availability = availability;
    }
    
    if (communicationPreference) {
      student.communicationPreference = communicationPreference;
    }
    
    if (matchingPreferences) {
      student.matchingPreferences = matchingPreferences;
    }
    
    await student.save();
    
    res.json({ 
      message: "Matching preferences updated successfully",
      student: {
        id: student._id,
        name: student.name,
        detailedInterests: Object.fromEntries(student.detailedInterests || []),
        learningStyle: student.learningStyle,
        availability: student.availability,
        communicationPreference: student.communicationPreference,
        matchingPreferences: student.matchingPreferences
      }
    });
  } catch (err) {
    console.error("Error updating matching preferences:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update alumni matching profile
router.put('/alumni-profile', async (req, res) => {
  try {
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'alumni') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const { 
      expertiseAreas, 
      industryExperience, 
      mentorStyle, 
      availability,
      communicationPreference,
      preferredMenteeAttributes
    } = req.body;
    
    const alumni = await Alumni.findById(decoded.userId);
    if (!alumni) {
      return res.status(404).json({ message: "Alumni not found" });
    }
    
    // Update fields if provided
    if (expertiseAreas) {
      alumni.expertiseAreas = new Map(Object.entries(expertiseAreas));
    }
    
    if (industryExperience) {
      alumni.industryExperience = industryExperience;
    }
    
    if (mentorStyle) {
      alumni.mentorStyle = mentorStyle;
    }
    
    if (availability) {
      alumni.availability = availability;
    }
    
    if (communicationPreference) {
      alumni.communicationPreference = communicationPreference;
    }
    
    if (preferredMenteeAttributes) {
      alumni.preferredMenteeAttributes = preferredMenteeAttributes;
    }
    
    await alumni.save();
    
    res.json({ 
        message: "Mentor profile updated successfully",
        alumni: {
          id: alumni._id,
          name: alumni.name,
          expertiseAreas: Object.fromEntries(alumni.expertiseAreas || []),
          industryExperience: alumni.industryExperience,
          mentorStyle: alumni.mentorStyle,
          availability: alumni.availability,
          communicationPreference: alumni.communicationPreference,
          preferredMenteeAttributes: alumni.preferredMenteeAttributes
        }
      });
    } catch (err) {
      console.error("Error updating alumni profile:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Get mentor recommendations for a student
  router.get('/recommendations', authStudent, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const recommendations = await matchingService.generateRecommendations(req.user.userId, limit);
      
      // Format the response
      const formattedRecommendations = recommendations.map(rec => ({
        alumniId: rec.alumni._id,
        name: rec.alumni.name,
        email: rec.alumni.email,
        careerInsights: rec.alumni.careerInsights,
        expertiseAreas: Object.fromEntries(rec.alumni.expertiseAreas || []),
        industryExperience: rec.alumni.industryExperience,
        mentorStyle: rec.alumni.mentorStyle,
        matchScore: Math.round(rec.score * 100),
        compatibilityDetails: {
          expertise: Math.round(rec.similarityScore * 100),
          availability: Math.round(rec.availabilityScore * 100),
          communication: Math.round(rec.communicationScore * 100)
        }
      }));
      
      res.json({ recommendations: formattedRecommendations });
    } catch (err) {
      console.error("Error getting recommendations:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Submit feedback for a mentor match
  router.post('/feedback', authStudent, async (req, res) => {
    try {
      const { alumniId, rating, feedback } = req.body;
      
      if (!alumniId || !rating) {
        return res.status(400).json({ message: "Alumni ID and rating are required" });
      }
      
      // Validate rating
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }
      
      await matchingService.recordMatchFeedback(req.user.userId, alumniId, rating, feedback);
      
      res.json({ message: "Feedback recorded successfully" });
    } catch (err) {
      console.error("Error recording feedback:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  module.exports = router;
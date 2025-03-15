const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const jwt = require('jsonwebtoken');
const Webinar = require('../models/Webinar');
const upload = require('../functing/videoUpload');

// Middleware to verify token and ensure the user is an alumni
const authAlumni = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token)
    return res.status(401).json({ message: "No token, authorization denied" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'alumni')
      return res.status(403).json({ message: "Access denied" });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Upload video for a webinar
router.post('/upload/:webinarId', authAlumni, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      // Delete the uploaded file if webinar doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Webinar not found" });
    }

    // Check if the alumni is the host of the webinar
    if (webinar.host.toString() !== req.user.userId) {
      // Delete the uploaded file if not authorized
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "Not authorized to upload video for this webinar" });
    }

    // If there was a previous video, delete it
    if (webinar.videoFile && webinar.videoFile.path) {
      const oldFilePath = path.join(__dirname, '..', webinar.videoFile.path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update webinar with new video file info
    webinar.videoFile = {
      filename: req.file.filename,
      path: req.file.path.replace(/\\/g, '/').replace(/^.*\/uploads/, '/uploads'),
      mimetype: req.file.mimetype,
      size: req.file.size
    };
    webinar.isUploaded = true;
    
    await webinar.save();
    
    res.status(200).json({ 
      message: "Video uploaded successfully",
      webinar: {
        id: webinar._id,
        title: webinar.title,
        videoType: webinar.videoType,
        videoFile: webinar.videoFile
      }
    });
  } catch (err) {
    console.error("Error uploading video:", err);
    // Clean up file if there was an error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: "Server error during upload" });
  }
});

// Delete video from a webinar
router.delete('/delete/:webinarId', authAlumni, async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    // Check if the alumni is the host of the webinar
    if (webinar.host.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to delete video for this webinar" });
    }

    // If there's a video file, delete it
    if (webinar.videoFile && webinar.videoFile.path) {
      const filePath = path.join(__dirname, '..', webinar.videoFile.path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update webinar to remove video file info
    webinar.videoFile = undefined;
    webinar.isUploaded = false;
    
    await webinar.save();
    
    res.status(200).json({ message: "Video deleted successfully" });
  } catch (err) {
    console.error("Error deleting video:", err);
    res.status(500).json({ message: "Server error during deletion" });
  }
});
// Stream video for a webinar (continued)
router.get('/stream/:webinarId', async (req, res) => {
  let fileStream; // Declare the file stream in the outer scope for access in catch
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar || !webinar.videoFile || !webinar.videoFile.path) {
      return res.status(404).json({ message: "Video not found" });
    }

    const filePath = path.join(__dirname, '..', webinar.videoFile.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Video file not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      fileStream = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': webinar.videoFile.mimetype
      });
      
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': webinar.videoFile.mimetype
      });
      
      fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  } catch (err) {
    // Clean up any open file streams
    if (fileStream) {
      fileStream.destroy();
    }
    console.error("Error streaming video:", err);
    res.status(500).json({ message: "Server error during streaming" });
  }
});
  
  // Get all webinars with videos for a student
  router.get('/student/webinars', async (req, res) => {
    try {
      const token = req.header('Authorization');
      if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'student') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const studentId = decoded.userId;
      
      // Find alumni who have this student in their connections
      const Student = require('../models/Student');
      const student = await Student.findById(studentId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Get webinars from connected alumni that have videos uploaded or are live
      const webinars = await Webinar.find({
        host: { $in: student.connections },
        $or: [{ isUploaded: true }, { isLive: true }]
      }).populate("host", "name email");
      
      res.json(webinars);
    } catch (err) {
      console.error("Error fetching webinars:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  // Create an on-site webinar
router.post('/create-onsite', authAlumni, async (req, res) => {
  try {
    const { title, description, scheduledAt, location } = req.body;
    
    if (!location || !location.address || !location.venue) {
      return res.status(400).json({ message: "Location details are required for on-site webinars" });
    }

    const webinar = new Webinar({
      title,
      description,
      host: req.user.userId,
      scheduledAt,
      videoType: "on-site",
      location,
      isOnSite: true
    });

    await webinar.save();
    
    res.status(201).json({ 
      message: "On-site webinar created successfully",
      webinar: {
        id: webinar._id,
        title: webinar.title,
        scheduledAt: webinar.scheduledAt,
        location: webinar.location
      }
    });
  } catch (err) {
    console.error("Error creating on-site webinar:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update on-site webinar details
router.put('/update-onsite/:webinarId', authAlumni, async (req, res) => {
  try {
    const { title, description, scheduledAt, location } = req.body;
    
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    // Check if the alumni is the host of the webinar
    if (webinar.host.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to update this webinar" });
    }

    // Update webinar details
    if (title) webinar.title = title;
    if (description) webinar.description = description;
    if (scheduledAt) webinar.scheduledAt = scheduledAt;
    if (location) {
      webinar.location = location;
      webinar.isOnSite = true;
    }
    
    await webinar.save();
    
    res.status(200).json({ 
      message: "On-site webinar updated successfully",
      webinar: {
        id: webinar._id,
        title: webinar.title,
        scheduledAt: webinar.scheduledAt,
        location: webinar.location
      }
    });
  } catch (err) {
    console.error("Error updating on-site webinar:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all on-site webinars for a student
router.get('/student/onsite-webinars', async (req, res) => {
  try {
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'student') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const studentId = decoded.userId;
    
    // Find alumni who have this student in their connections
    const Student = require('../models/Student');
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Get on-site webinars from connected alumni
    const webinars = await Webinar.find({
      host: { $in: student.connections },
      isOnSite: true
    }).populate("host", "name email");
    
    res.json(webinars);
  } catch (err) {
    console.error("Error fetching on-site webinars:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Register for an on-site webinar
router.post('/register-onsite/:webinarId', async (req, res) => {
  try {
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'student') {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const studentId = decoded.userId;
    const webinarId = req.params.webinarId;
    
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }
    
    if (!webinar.isOnSite) {
      return res.status(400).json({ message: "This is not an on-site webinar" });
    }
    
    // Check if student is connected to the host
    const Student = require('../models/Student');
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    const canRegister = student.connections.includes(webinar.host);
    
    if (!canRegister) {
      return res.status(403).json({ message: "You are not connected to this webinar host" });
    }
    
    // Check if student is already registered
    if (webinar.participants.includes(studentId)) {
      return res.status(400).json({ message: "You are already registered for this webinar" });
    }
    
    // Add student to participants
    webinar.participants.push(studentId);
    await webinar.save();
    
    res.json({ 
      message: "Successfully registered for the on-site webinar",
      webinar: {
        id: webinar._id,
        title: webinar.title,
        scheduledAt: webinar.scheduledAt,
        location: webinar.location
      }
    });
  } catch (err) {
    console.error("Error registering for on-site webinar:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get registered students for an on-site webinar
router.get('/onsite-participants/:webinarId', authAlumni, async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    // Check if the alumni is the host of the webinar
    if (webinar.host.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to view participants for this webinar" });
    }
    
    if (!webinar.isOnSite) {
      return res.status(400).json({ message: "This is not an on-site webinar" });
    }
    
    // Get participant details
    const participants = await Student.find({
      _id: { $in: webinar.participants }
    }).select("name email collegeId");
    
    res.json(participants);
  } catch (err) {
    console.error("Error fetching on-site webinar participants:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// End a live webinar
router.post('/end-live/:webinarId', authAlumni, async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }
  
    // Check if the alumni is the host of the webinar
    if (webinar.host.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to end live stream for this webinar" });
    }
  
    // Update webinar to mark it as not live
    webinar.isLive = false;
    webinar.liveRoomId = undefined;
    
    await webinar.save();
    
    res.status(200).json({ message: "Live webinar ended successfully" });
  } catch (err) {
    console.error("Error ending live webinar:", err);
    res.status(500).json({ message: "Server error" });
  }
});
  
  // Get live webinar details
  router.get('/live/:webinarId', async (req, res) => {
    try {
      const webinar = await Webinar.findById(req.params.webinarId);
      
      if (!webinar) {
        return res.status(404).json({ message: "Webinar not found" });
      }
  
      if (!webinar.isLive) {
        return res.status(400).json({ message: "Webinar is not currently live" });
      }
      
      res.json({
        id: webinar._id,
        title: webinar.title,
        host: webinar.host,
        liveRoomId: webinar.liveRoomId,
        isLive: webinar.isLive
      });
    } catch (err) {
      console.error("Error fetching live webinar details:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Get all live webinars for a student
  router.get('/student/live-webinars', async (req, res) => {
    try {
      const token = req.header('Authorization');
      if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'student') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const studentId = decoded.userId;
      
      // Find alumni who have this student in their connections
      const Student = require('../models/Student');
      const student = await Student.findById(studentId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Get live webinars from connected alumni
      const webinars = await Webinar.find({
        host: { $in: student.connections },
        isLive: true
      }).populate("host", "name email");
      
      res.json(webinars);
    } catch (err) {
      console.error("Error fetching live webinars:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Check if a student can join a live webinar
  router.get('/can-join/:webinarId', async (req, res) => {
    try {
      const token = req.header('Authorization');
      if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 'student') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const studentId = decoded.userId;
      const webinarId = req.params.webinarId;
      
      const webinar = await Webinar.findById(webinarId);
      if (!webinar) {
        return res.status(404).json({ message: "Webinar not found" });
      }
      
      if (!webinar.isLive) {
        return res.status(400).json({ message: "Webinar is not currently live" });
      }
      
      // Check if student is connected to the host
      const Student = require('../models/Student');
      const student = await Student.findById(studentId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      const canJoin = student.connections.includes(webinar.host);
      
      if (!canJoin) {
        return res.status(403).json({ message: "You are not connected to this webinar host" });
      }
      
      res.json({ canJoin: true, webinar });
    } catch (err) {
      console.error("Error checking webinar access:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
  
  module.exports = router;
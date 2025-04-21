const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const jwt = require('jsonwebtoken');
const Webinar = require('../models/Webinar');
const Alumni = require('../models/Alumni');
const upload = require('../functing/videoUpload');
const youtubeService = require('../services/youtubeService');
const { google } = require('googleapis');

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

// Check if user has connected YouTube
router.get('/youtube-status', authAlumni, async (req, res) => {
  try {
    const connected = await youtubeService.isYoutubeConnected(req.user.userId);
    res.json({ connected });
  } catch (error) {
    console.error('Error checking YouTube status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get YouTube authorization URL
router.get('/youtube-auth-url', authAlumni, (req, res) => {
  try {
    const authUrl = youtubeService.getAuthUrl(req.user.userId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// YouTube OAuth callback
router.get('/youtube-callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state');
    }
    
    // state contains the user ID
    const userId = state;
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.REDIRECT_URI
    );
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Save tokens to user's record
    await Alumni.findByIdAndUpdate(userId, { youtubeTokens: tokens });
    
    // Close the window with a success message
    res.send(`
      <html>
        <body>
          <h1>YouTube Connected Successfully!</h1>
          <p>You can close this window and return to the application.</p>
          <script>
            setTimeout(function() {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Error connecting to YouTube: ' + error.message);
  }
});

// Upload video to server and optionally to YouTube
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
    if (webinar.host && webinar.host.toString() !== req.user.userId) {
      // Delete the uploaded file if not authorized
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ message: "Not authorized to upload video for this webinar" });
    }

    // Update webinar with video file info
    const videoInfo = {
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    };
    
    // Check if we should upload to YouTube
    const uploadToYoutube = req.body.uploadToYoutube === 'true';
    const privacyStatus = req.body.privacyStatus || 'private'; // Default to private
    
    if (uploadToYoutube) {
      try {
        // Check if user has connected YouTube
        const connected = await youtubeService.isYoutubeConnected(req.user.userId);
        
        if (!connected) {
          return res.status(400).json({ 
            message: "YouTube account not connected. Please connect your YouTube account first." 
          });
        }
        
        // Upload to YouTube with privacy status
        const youtubeData = await youtubeService.uploadVideo(
          req.user.userId,
          req.file.path,
          webinar.title,
          webinar.description,
          privacyStatus
        );
        
        // Add YouTube data to video info
        videoInfo.videoId = youtubeData.id;
        videoInfo.url = youtubeData.url;
        videoInfo.embedUrl = youtubeData.embedUrl;
        videoInfo.thumbnailUrl = youtubeData.thumbnailUrl;
        videoInfo.privacyStatus = privacyStatus;
      } catch (error) {
        console.error('YouTube upload error:', error);
        // Continue with local upload even if YouTube upload fails
      }
    }

    // Update webinar with video info
    webinar.videoFile = videoInfo;
    webinar.isUploaded = true;
    await webinar.save();

    res.status(200).json({ 
      message: "Video uploaded successfully",
      uploadedToYoutube: !!(videoInfo.videoId),
      privacyStatus: videoInfo.privacyStatus || 'local'
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    // Delete the uploaded file if there's an error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    res.status(500).json({ message: "Server error", error: error.message });
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
    if (webinar.host && webinar.host.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to delete video for this webinar" });
    }

    // If it's a YouTube video, delete it from YouTube
    if (webinar.videoFile && webinar.videoFile.videoId) {
      try {
        await youtubeService.deleteVideo(webinar.videoFile.videoId);
      } catch (youtubeError) {
        console.error('Error deleting from YouTube:', youtubeError);
        // Continue with local deletion even if YouTube deletion fails
      }
    }

    // If there's a local file, delete it
    if (webinar.videoFile && webinar.videoFile.path && !webinar.videoFile.videoId) {
      const filePath = path.join(__dirname, '..', 'public', webinar.videoFile.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update webinar
    webinar.videoFile = null;
    webinar.isUploaded = false;
    
    await webinar.save();
    
    res.status(200).json({ message: "Video deleted successfully" });
  } catch (err) {
    console.error("Error deleting video:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get video details
// In your GET video details route, update the response:

router.get('/:webinarId', async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: "Webinar not found" });
    }

    if (!webinar.videoFile) {
      return res.status(404).json({ message: "No video found for this webinar" });
    }

    // Add the full URL for the video file
    let videoDetails = { ...webinar.videoFile };
    
    // If it's a local video, add the full URL
    if (videoDetails.filename && !videoDetails.videoId) {
      videoDetails.fullUrl = `http://localhost:5000/uploads/videos/${videoDetails.filename}`;
    }

    res.json({
      webinarId: webinar._id,
      title: webinar.title,
      description: webinar.description,
      videoDetails: videoDetails
    });
  } catch (err) {
    console.error("Error getting video details:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Mark a webinar as live
router.put('/webinar/:id/go-live', authAlumni, async (req, res) => {
  try {
    const webinarId = req.params.id;
    const alumniId = req.user.userId;
    
    // Find the webinar and verify ownership
    const webinar = await Webinar.findById(webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: 'Webinar not found' });
    }
    
    if (webinar.host.toString() !== alumniId) {
      return res.status(403).json({ message: 'Not authorized to modify this webinar' });
    }
    
    // Generate a room ID based on webinar ID (or use webinar ID directly)
    const streamRoomId = webinarId.toString();
    
    // Update the webinar to mark it as live and store the stream room ID
    webinar.isLive = true;
    webinar.streamRoomId = streamRoomId;
    await webinar.save();
    
    // Return the stream URL that will be used for redirection
    const streamHostUrl = `http://localhost:3000/host?room=${streamRoomId}&webinar=${webinarId}`;
    
    res.json({ 
      message: 'Webinar is now live', 
      webinar,
      streamUrl: streamHostUrl
    });
  } catch (error) {
    console.error('Error marking webinar as live:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get stream info for a webinar
router.get('/webinar/:id/stream-info', async (req, res) => {
  try {
    const webinarId = req.params.id;
    
    // Find the webinar
    const webinar = await Webinar.findById(webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: 'Webinar not found' });
    }
    
    if (!webinar.isLive) {
      return res.status(400).json({ message: 'This webinar is not currently live' });
    }
    
    // Return the stream URL for viewers
    const streamViewerUrl = `http://localhost:3000/view?room=${webinar.streamRoomId}&webinar=${webinarId}`;
    
    res.json({
      isLive: webinar.isLive,
      streamUrl: streamViewerUrl,
      roomId: webinar.streamRoomId
    });
  } catch (error) {
    console.error('Error getting stream info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// End a live webinar
router.put('/webinar/:id/end-live', authAlumni, async (req, res) => {
  try {
    const webinarId = req.params.id;
    const alumniId = req.user.userId;
    
    // Find the webinar and verify ownership
    const webinar = await Webinar.findById(webinarId);
    
    if (!webinar) {
      return res.status(404).json({ message: 'Webinar not found' });
    }
    
    if (webinar.host.toString() !== alumniId) {
      return res.status(403).json({ message: 'Not authorized to modify this webinar' });
    }
    
    // Update the webinar to mark it as not live and clear the stream room ID
    webinar.isLive = false;
    webinar.streamRoomId = null;
    await webinar.save();
    
    res.json({ message: 'Live webinar ended', webinar });
  } catch (error) {
    console.error('Error ending live webinar:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload video to YouTube
router.post('/upload-to-youtube/:webinarId', authAlumni, async (req, res) => {
  try {
    const { webinarId } = req.params;
    const { title, description, privacyStatus } = req.body;
    
    console.log(`Received YouTube upload request for webinar: ${webinarId}`);
    
    // Find the webinar
    const webinar = await Webinar.findById(webinarId);
    if (!webinar) {
      return res.status(404).json({ message: 'Webinar not found' });
    }
    
    // Check if webinar belongs to the user
    if (webinar.alumniId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to upload for this webinar' });
    }
    
    // Check if video exists
    if (!webinar.videoDetails || !webinar.videoDetails.path) {
      return res.status(400).json({ message: 'No video file found for this webinar' });
    }
    
    const videoPath = path.join(__dirname, '..', webinar.videoDetails.path);
    console.log('Video path:', videoPath);
    
    // Upload to YouTube
    const youtubeData = await youtubeService.uploadVideo(
      req.user.userId,
      videoPath,
      title || webinar.title,
      description || webinar.description,
      privacyStatus || 'private'
    );
    
    // Update webinar with YouTube data
    webinar.videoDetails.youtubeId = youtubeData.id;
    webinar.videoDetails.embedUrl = `https://www.youtube.com/embed/${youtubeData.id}`;
    await webinar.save();
    
    res.json({ 
      success: true, 
      message: 'Video uploaded to YouTube successfully',
      youtubeData
    });
  } catch (error) {
    console.error('Error uploading to YouTube:', error);
    res.status(500).json({ 
      message: 'Failed to upload to YouTube', 
      error: error.message 
    });
  }
});

router.get('/student/webinars', async (req, res) => {
  try {
    const webinars = await Webinar.find({ /* your filter */ }).populate('host');
    // Add embedUrl for YouTube videos if missing
    const webinarsWithEmbed = webinars.map(w => {
      let embedUrl = w.videoFile?.embedUrl;
      if (!embedUrl && w.videoFile?.videoId) {
        embedUrl = `https://www.youtube.com/embed/${w.videoFile.videoId}`;
      }
      return {
        ...w.toObject(),
        videoDetails: {
          ...w.videoFile,
          embedUrl,
          localUrl: w.videoFile?.filename ? `http://localhost:5000/uploads/videos/${w.videoFile.filename}` : null
        }
      };
    });
    res.json(webinarsWithEmbed);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
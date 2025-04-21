// services/youtubeService.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const Alumni = require('../models/Alumni');

// YouTube API setup
const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
  );
};

// Generate authorization URL
const getAuthUrl = (userId) => {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId, // Pass user ID to callback
    prompt: 'consent' // Force to get refresh token
  });
};

// Set credentials using user's tokens
const setUserCredentials = async (userId) => {
  try {
    const alumni = await Alumni.findById(userId);
    if (!alumni || !alumni.youtubeTokens) {
      throw new Error('No YouTube tokens found for this user');
    }
    
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(alumni.youtubeTokens);
    
    // Check if token is expired and refresh if needed
    if (alumni.youtubeTokens.expiry_date < Date.now()) {
      console.log('Token expired, refreshing...');
      try {
        const { tokens } = await oauth2Client.refreshToken(alumni.youtubeTokens.refresh_token);
        
        // Update tokens in database
        alumni.youtubeTokens = tokens;
        await alumni.save();
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        throw new Error('Failed to refresh YouTube token. Please reconnect your YouTube account.');
      }
    }
    
    return oauth2Client;
  } catch (error) {
    console.error('Error setting user credentials:', error);
    throw error;
  }
};

// Upload video to YouTube
const uploadVideo = async (userId, videoFilePath, title, description, privacyStatus = 'private') => {
  try {
    console.log('Starting YouTube upload process...');
    const oauth2Client = await setUserCredentials(userId);
    
    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });
    
    // Verify file exists before upload
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`Video file not found at path: ${videoFilePath}`);
    }
    
    console.log('Uploading to YouTube:', title);
    
    const fileSize = fs.statSync(videoFilePath).size;
    
    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description,
          categoryId: '27' // Education category
        },
        status: {
          privacyStatus: privacyStatus // Now using parameter with 'private' as default
        }
      },
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    }, {
      onUploadProgress: evt => {
        const progress = (evt.bytesRead / fileSize) * 100;
        console.log(`${Math.round(progress)}% complete`);
      }
    });
    
    return {
      id: res.data.id,
      url: `https://www.youtube.com/watch?v=${res.data.id}`,
      embedUrl: `https://www.youtube.com/embed/${res.data.id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${res.data.id}/hqdefault.jpg`
    };
  } catch (error) {
    console.error('Error uploading to YouTube:', error);
    throw error;
  }
};

// Check if user has connected YouTube
const isYoutubeConnected = async (userId) => {
  try {
    const alumni = await Alumni.findById(userId);
    return !!(alumni && alumni.youtubeTokens && alumni.youtubeTokens.refresh_token);
  } catch (error) {
    console.error('Error checking YouTube connection:', error);
    return false;
  }
};

module.exports = {
  getAuthUrl,
  uploadVideo,
  isYoutubeConnected
};
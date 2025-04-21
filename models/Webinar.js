const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Add this field to your Webinar schema
const WebinarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  host: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true },
  scheduledAt: { type: Date, required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  videoLink: { type: String },
  videoType: { type: String, enum: ["live", "recorded", "on-site"], required: true },
  location: {
    address: { type: String },
    city: { type: String },
    venue: { type: String }
  },
  isOnSite: { type: Boolean, default: false },
  videoFile: { 
    filename: { type: String },
    path: { type: String },
    mimetype: { type: String },
    size: { type: Number },
    // YouTube specific fields
    videoId: String,      // YouTube video ID
    url: String,          // YouTube watch URL
    embedUrl: String,     // YouTube embed URL
    thumbnailUrl: String  // YouTube thumbnail URL
  },
  isUploaded: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false },
  liveRoomId: { type: String },
  createdAt: { type: Date, default: Date.now },
  streamRoomId: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('Webinar', WebinarSchema);  // Changed from webinarSchema to WebinarSchema
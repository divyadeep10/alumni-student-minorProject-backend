const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const webinarSchema = new Schema({
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
    size: { type: Number }
  },
  isUploaded: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false },
  liveRoomId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Webinar', webinarSchema);
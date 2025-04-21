// Add this to your existing Alumni schema
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Assuming you have an existing Alumni schema, add this field:
const alumniSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  collegeId: { type: String, required: true },
  careerInsights: { type: String },
  password: { type: String, required: true },
  mentees: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  connections: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  createdAt: { type: Date, default: Date.now },
  expertiseAreas: { type: Map, of: Number },
  industryExperience: [String],
  mentorStyle: { type: String, enum: ['directive', 'non-directive', 'collaborative', 'observational'] },
  availability: [{ 
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    startTime: String,
    endTime: String
  }],
  communicationPreference: { type: String, enum: ['email', 'video', 'chat', 'in-person'] },
  preferredMenteeAttributes: [String],
  mentorshipHistory: [{
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    startDate: Date,
    endDate: Date,
    outcome: { type: String, enum: ['ongoing', 'completed', 'discontinued'] },
    notes: String
  }],
  youtubeTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  isAdmin: { type: Boolean, default: false }  // Removed comma here
});

// If this is a new file, add:
module.exports = mongoose.model('Alumni', alumniSchema);
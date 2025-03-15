const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const alumniSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  collegeId: { type: String, required: true },
  careerInsights: { type: String },
  password: { type: String, required: true },
  mentees: [{ type: Schema.Types.ObjectId, ref: 'Student' }], // accepted student requests
  connections: [{ type: Schema.Types.ObjectId, ref: 'Student' }],
  createdAt: { type: Date, default: Date.now },
  // New fields for AI matching
  expertiseAreas: { type: Map, of: Number }, // Expertise areas with strength (1-10)
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
  }]
});

module.exports = mongoose.model('Alumni', alumniSchema);
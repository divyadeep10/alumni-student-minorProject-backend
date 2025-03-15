// models/Student.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const studentSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  collegeId: { type: String, required: true },
  interests: [String],
  careerGoals: { type: String },
  password: { type: String, required: true }, // store hashed password
  connections: [{ type: Schema.Types.ObjectId, ref: 'Alumni' }], // linked alumni mentors
  createdAt: { type: Date, default: Date.now },
  // New fields for AI matching
  detailedInterests: { type: Map, of: Number }, // Interest areas with strength (1-10)
  learningStyle: { type: String, enum: ['visual', 'auditory', 'reading', 'kinesthetic', 'mixed'] },
  availability: [{ 
    day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
    startTime: String,
    endTime: String
  }],
  communicationPreference: { type: String, enum: ['email', 'video', 'chat', 'in-person'] },
  matchingPreferences: {
    expertiseImportance: { type: Number, default: 5 }, // 1-10
    availabilityImportance: { type: Number, default: 3 }, // 1-10
    communicationImportance: { type: Number, default: 2 } // 1-10
  },
  matchFeedback: [{
    alumniId: { type: Schema.Types.ObjectId, ref: 'Alumni' },
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Student', studentSchema);

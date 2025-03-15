// Keeps track of mentorship requests between students and alumni.

// models/Mentorship.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mentorshipSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  alumni: { type: Schema.Types.ObjectId, ref: 'Alumni', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mentorship', mentorshipSchema);

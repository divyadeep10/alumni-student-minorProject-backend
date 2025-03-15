const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discussionSchema = new Schema({
  author: { type: Schema.Types.ObjectId, required: true, refPath: 'authorModel' }, // Dynamic reference
  authorModel: { type: String, required: true, enum: ['Alumni', 'Student'] }, // Specifies which model to reference
  title: { type: String, required: true },
  content: { type: String, required: true },
  comments: [{
    user: { type: Schema.Types.ObjectId, required: true, refPath: 'comments.userModel' },
    userModel: { type: String, required: true, enum: ['Alumni', 'Student'] }, // Dynamic user reference
    comment: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Discussion', discussionSchema);

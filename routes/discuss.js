// routes/discussion.js
const express = require('express');
const router = express.Router();

const Discussion = require('../models/Discussion');
const authMiddleware = require('../middleware/authh');

// Get all discussions (protected)
router.get('/discussions', async (req, res) => {
  try {
    const discussions = await Discussion.find()
      .populate('author', 'name')
      .populate('comments.user', 'name');
    res.json(discussions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching discussions' });
  }
});

// Post a new discussion (works for both alumni and students)
router.post("/alumni/post", authMiddleware, async (req, res) => {
  try {
      console.log("User Info:", req.user, "User Model:", req.userModel);

      if (!req.user) return res.status(401).json({ error: "Unauthorized: No user found." });

      const { title, content } = req.body;

      const newDiscussion = new Discussion({
          author: req.user._id,
          authorModel: req.userModel, // Can be "Alumni" or "Student"
          title,
          content,
          comments: [],
      });

      await newDiscussion.save();
      res.status(201).json({ message: "Discussion created successfully", discussion: newDiscussion });

  } catch (error) {
      console.error("Error creating discussion:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
  
// Post a comment to a discussion post
router.post('/discussions/:postId/comment', authMiddleware, async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const discussion = await Discussion.findById(req.params.postId);
    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    // Add comment to the discussion
    discussion.comments.push({
      user: req.user._id,  // Corrected user ID reference
      userModel: req.userModel, // Corrected role reference (Student or Alumni)
      comment,
    });

    await discussion.save();
    
    res.status(201).json({ message: 'Comment added successfully', discussion });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

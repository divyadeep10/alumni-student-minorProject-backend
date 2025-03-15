// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const http = require('http');
const path = require('path');
const initWebRTCServer = require('./functing/webrtcServer');

// Route files
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/studentFunctions');
const alumniRoutes = require('./routes/alumniFunction');
const discussionRoutes = require('./routes/discuss');
const videoRoutes = require('./routes/videoRoutes');
const matchingRoutes = require('./routes/matchingRoutes'); // Add this line

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize WebRTC server
const io = initWebRTCServer(server);

// Middleware
app.use(cors({
  origin: "*", // In production, replace with your frontend URL
  methods: "GET, POST, PUT, DELETE",
  allowedHeaders: "Content-Type, Authorization",
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    message: "Welcome to the Alumni-Student Mentorship Platform API",
    status: "Server is running correctly",
    version: "1.0.0"
  });
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/discussion', discussionRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/matching', matchingRoutes); // Add this line

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server running on port ${port}`));

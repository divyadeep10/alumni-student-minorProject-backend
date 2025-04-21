// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

// Then load other dependencies
const connectDB = require('./config/database');
const http = require('http');
const path = require('path');
const initWebRTCServer = require('./functing/webrtcServer');
const session = require('express-session');

// Connect to database after env vars are loaded
connectDB();

// Route files
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/studentFunctions');
const alumniRoutes = require('./routes/alumniFunction');
const discussionRoutes = require('./routes/discuss');
const videoRoutes = require('./routes/videoRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const adminRoutes = require('./routes/adminRoutes');  // Make sure this file exists and exports a router

// Remove the duplicate dotenv.config()
// require('dotenv').config();  // Remove this line

const app = express();
const server = http.createServer(app);

// Initialize WebRTC server
console.log('Initializing WebRTC server...');
const io = initWebRTCServer(server);
console.log('WebRTC server initialized');

// Middleware
app.use(cors({
  origin: "*", // In production, replace with your frontend URL
  methods: "GET, POST, PUT, DELETE",
  allowedHeaders: "Content-Type, Authorization",
  credentials: true // Add this to allow cookies to be sent with requests
}));

// Add session middleware
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
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
// Add this near your other middleware setup (around line 46)
app.use(express.static(path.join(__dirname, 'public')));
// Serve static files from uploads directory
app.use('/uploads/videos', express.static(path.join(__dirname, 'uploads/videos')));
// Add this line to serve the uploads directory directly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/discussion', discussionRoutes);
// Make sure this line exists in your server.js file
app.use('/api/videos', videoRoutes);
app.use('/api/matching', matchingRoutes);
// app.use('/api/metrics', metricsRoutes);
app.use('/api/admin', adminRoutes);  // Uncomment this line

// The error is likely happening here - make sure all routes are properly exported as router objects
// Remove any incorrect middleware usage

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`Server running on port ${port}`));

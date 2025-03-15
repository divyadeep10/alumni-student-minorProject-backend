const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Webinar = require('../models/Webinar');

// Store active rooms and their participants
const rooms = new Map();

const initWebRTCServer = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('New WebRTC connection:', socket.id);

    // Host starts a live stream
    socket.on('start-stream', async ({ webinarId, token }) => {
      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'alumni') {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        // Verify the user is the host of the webinar
        const webinar = await Webinar.findById(webinarId);
        if (!webinar) {
          socket.emit('error', { message: 'Webinar not found' });
          return;
        }

        if (webinar.host.toString() !== decoded.userId) {
          socket.emit('error', { message: 'Not authorized to host this webinar' });
          return;
        }

        // Use webinar ID as room ID for simplicity
        const roomId = webinarId;
        
        // Update webinar with live status
        webinar.isLive = true;
        webinar.liveRoomId = roomId;
        await webinar.save();

        // Create a new room
        rooms.set(roomId, {
          host: socket.id,
          participants: new Set(),
          webinarId
        });

        // Join the room
        socket.join(roomId);
        
        // Send room info back to host
        socket.emit('stream-started', { 
          roomId,
          webinarId,
          title: webinar.title
        });
        
        console.log(`Host ${socket.id} started stream for webinar ${webinarId} in room ${roomId}`);
      } catch (error) {
        console.error('Error starting stream:', error);
        socket.emit('error', { message: 'Server error', details: error.message });
      }
    });

    // Student joins a live stream
    socket.on('join-stream', async ({ webinarId, token }) => {
      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'student') {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const webinar = await Webinar.findById(webinarId);
        if (!webinar || !webinar.isLive) {
          socket.emit('error', { message: 'Webinar is not live' });
          return;
        }

        const roomId = webinar.liveRoomId;
        
        // Check if room exists
        if (!rooms.has(roomId)) {
          socket.emit('error', { message: 'Stream not found' });
          return;
        }

        const room = rooms.get(roomId);
        
        // Add participant to room
        room.participants.add(socket.id);
        
        // Join the room
        socket.join(roomId);
        
        // Notify host of new participant
        io.to(room.host).emit('new-viewer', { socketId: socket.id });
        
        console.log(`Participant ${socket.id} joined stream in room ${roomId}`);
        
        // Send room info back to participant
        socket.emit('stream-joined', { 
          roomId,
          hostId: room.host,
          webinarId,
          title: webinar.title
        });
      } catch (error) {
        console.error('Error joining stream:', error);
        socket.emit('error', { message: 'Server error', details: error.message });
      }
    });

    // Signal relay for WebRTC
    socket.on('signal', ({ to, signal }) => {
      io.to(to).emit('signal', {
        from: socket.id,
        signal
      });
    });

    // Host ends the stream
    socket.on('end-stream', async ({ webinarId, token }) => {
      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'alumni') {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const webinar = await Webinar.findById(webinarId);
        if (!webinar) {
          socket.emit('error', { message: 'Webinar not found' });
          return;
        }

        if (webinar.host.toString() !== decoded.userId) {
          socket.emit('error', { message: 'Not authorized to end this stream' });
          return;
        }

        const roomId = webinar.liveRoomId;
        if (!roomId || !rooms.has(roomId)) {
          socket.emit('error', { message: 'Stream not found' });
          return;
        }

        // Update webinar status
        webinar.isLive = false;
        webinar.liveRoomId = undefined;
        await webinar.save();

        // Notify all participants
        io.to(roomId).emit('stream-ended', { reason: 'Host ended the stream' });
        
        // Close the room
        rooms.delete(roomId);
        
        console.log(`Host ${socket.id} ended stream in room ${roomId}`);
        
        socket.emit('stream-end-confirmed');
      } catch (error) {
        console.error('Error ending stream:', error);
        socket.emit('error', { message: 'Server error', details: error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      // Check if disconnected socket was a host
      for (const [roomId, room] of rooms.entries()) {
        if (room.host === socket.id) {
          // Host disconnected, end the stream
          try {
            const webinar = await Webinar.findById(room.webinarId);
            if (webinar) {
              webinar.isLive = false;
              webinar.liveRoomId = undefined;
              await webinar.save();
            }
            
            // Notify all participants
            io.to(roomId).emit('stream-ended', { reason: 'Host disconnected' });
            
            // Close the room
            rooms.delete(roomId);
            console.log(`Room ${roomId} closed due to host disconnection`);
          } catch (error) {
            console.error('Error handling host disconnection:', error);
          }
        } else if (room.participants.has(socket.id)) {
          // Participant disconnected
          room.participants.delete(socket.id);
          io.to(room.host).emit('viewer-left', { socketId: socket.id });
        }
      }
    });
  });

  return io;
};

module.exports = initWebRTCServer;
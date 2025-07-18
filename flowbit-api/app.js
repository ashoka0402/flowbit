require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // For Socket.IO
const { Server } = require('socket.io'); // For Socket.IO

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const meRoutes = require('./routes/me');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.IO

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Allow your React app
    methods: ["GET", "POST"]
  }
});

// Pass io instance to webhook route handler
webhookRoutes.setSocketIO(io);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/flowbit')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json()); // For parsing JSON request bodies

// API Routes
app.use('/api', authRoutes);
app.use('/api', ticketRoutes);
app.use('/api', meRoutes);
app.use('/webhook', webhookRoutes); // Webhook endpoint for n8n callback

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('a user connected');

  // Join a room based on customerId (from user's JWT when they connect)
  // For simplicity, you might pass customerId in query param or after initial auth
  // Example: socket.on('join_tenant_room', (customerId) => { socket.join(customerId); });
  // This is crucial for tenant-aware real-time updates.
  // For now, let's assume you'll implement a way to get customerId and join a room later.
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Flowbit API running on port ${PORT}`));
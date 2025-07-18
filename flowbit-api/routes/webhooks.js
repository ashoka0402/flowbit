const express = require('express');
const Ticket = require('../models/Ticket');
const router = express.Router();

// Assuming you have a Socket.IO instance attached to your server
let io; // This will be set in app.js

// Function to set the Socket.IO instance
const setSocketIO = (socketIOInstance) => {
  io = socketIOInstance;
  console.log('Socket.IO instance set for webhooks');
};

router.post('/webhook/ticket-done', async (req, res) => {
  const sharedSecret = req.headers['x-flowbit-secret']; // Or whatever header you choose
  if (sharedSecret !== process.env.N8N_CALLBACK_SECRET) {
    return res.status(403).send('Unauthorized webhook call');
  }

  const { ticketId, status, customerId } = req.body; // n8n sends this

  try {
    // Ensure tenant isolation for the update as well
    const updatedTicket = await Ticket.findOneAndUpdate(
      { _id: ticketId, customerId: customerId }, // Filter by customerId
      { status: status, updatedAt: Date.now() },
      { new: true } // Return the updated document
    );

    if (!updatedTicket) {
      return res.status(404).send('Ticket not found for this tenant.');
    }

    console.log(`Ticket ${ticketId} updated to ${status} by n8n.`);

    // Emit WebSocket event to update UI
    if (io) {
      io.to(customerId).emit('ticket_updated', updatedTicket); // Emit to a room for the specific tenant
      console.log(`Emitted ticket_updated event for tenant ${customerId}`);
    }

    res.status(200).send('Webhook received and ticket updated.');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal server error.');
  }
});

// Export both the router and the setSocketIO function
module.exports = router;
module.exports.setSocketIO = setSocketIO;
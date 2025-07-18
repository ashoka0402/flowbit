const express = require('express');
const Ticket = require('../models/Ticket');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const axios = require('axios'); // Import axios for making HTTP requests to n8n

const router = express.Router();

// Middleware to protect routes and inject customerId from JWT
// Use authenticateToken on all routes where tenant context is needed.

// POST /api/tickets
// Creates a new support ticket for the logged-in tenant.
// It also triggers an n8n workflow for further processing.
router.post('/tickets', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const customerId = req.user.customerId; // Get customerId from the authenticated user's JWT

    if (!title || !description) {
      return res.status(400).send('Title and description are required.');
    }

    const newTicket = new Ticket({
      title,
      description,
      customerId, // Assign the ticket to the customerId from the JWT
      status: 'Open', // Initial status
    });

    await newTicket.save();

    console.log(`Ticket created for customer ${customerId}: ${newTicket._id}`);

    // --- Trigger n8n Workflow ---
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL; // Get n8n webhook URL from environment variables

    if (n8nWebhookUrl) {
      try {
        await axios.post(n8nWebhookUrl, {
          ticketId: newTicket._id,
          customerId: newTicket.customerId,
          status: newTicket.status, // Initial status
          title: newTicket.title,
          description: newTicket.description,
          // You can send any other data n8n might need
        });
        console.log(`Successfully triggered n8n workflow for ticket: ${newTicket._id}`);
      } catch (n8nError) {
        console.error('Error triggering n8n workflow:', n8nError.message);
        // Log the error but don't prevent ticket creation success
        // In a real app, you might have a retry mechanism here.
      }
    } else {
      console.warn('N8N_WEBHOOK_URL not set in environment. n8n workflow not triggered.');
    }

    res.status(201).json(newTicket); // Respond with the newly created ticket

  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).send('Internal Server Error: Could not create ticket.');
  }
});

// GET /api/tickets
// Retrieves all tickets for the logged-in tenant.
router.get('/tickets', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const tickets = await Ticket.find({ customerId }).sort({ createdAt: -1 }); // Filter by customerId
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).send('Internal Server Error: Could not retrieve tickets.');
  }
});

// GET /api/tickets/:id
// Retrieves a single ticket for the logged-in tenant, by ID.
// Restricted to Admin and User roles for this example.
router.get('/tickets/:id', authenticateToken, authorizeRole(['Admin', 'User']), async (req, res) => {
  try {
    const customerId = req.user.customerId;
    const ticket = await Ticket.findOne({ _id: req.params.id, customerId }); // Filter by customerId
    if (!ticket) {
      return res.status(404).send('Ticket not found or you do not have access to it.');
    }
    res.json(ticket);
  } catch (error) {
    console.error('Error fetching single ticket:', error);
    if (error.name === 'CastError') { // Handle invalid MongoDB ID format
      return res.status(400).send('Invalid Ticket ID format.');
    }
    res.status(500).send('Internal Server Error: Could not retrieve ticket.');
  }
});

// PUT /api/tickets/:id/status
// This endpoint is primarily for the n8n webhook callback.
// It updates the status of a ticket based on the provided ticketId and status.
// It includes shared secret verification for security.
router.put('/tickets/:id/status', async (req, res) => {
  const sharedSecret = req.headers['x-flowbit-secret']; // Get the shared secret from the header
  const expectedSecret = process.env.N8N_CALLBACK_SECRET; // Get expected secret from env

  if (!sharedSecret || sharedSecret !== expectedSecret) {
    console.warn('Unauthorized webhook call to /tickets/:id/status. Invalid or missing secret.');
    return res.status(403).send('Unauthorized webhook call.');
  }

  const { status, customerId } = req.body; // n8n sends ticketId in URL, status and customerId in body
  const ticketId = req.params.id;

  if (!status || !customerId) {
    return res.status(400).send('Status and customerId are required in the request body.');
  }

  // Define allowed statuses for validation
  const allowedStatuses = ['Open', 'InProgress', 'Done'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).send(`Invalid status provided. Must be one of: ${allowedStatuses.join(', ')}`);
  }

  try {
    // Find and update the ticket, ensuring it belongs to the specified customerId
    const updatedTicket = await Ticket.findOneAndUpdate(
      { _id: ticketId, customerId: customerId }, // Filter by both ID and customerId for strong isolation
      { status: status, updatedAt: Date.now() },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedTicket) {
      console.warn(`Ticket ${ticketId} not found or customerId mismatch for customer ${customerId}.`);
      return res.status(404).send('Ticket not found for the given ID and customer.');
    }

    console.log(`Ticket ${ticketId} status updated to '${status}' by n8n for customer ${customerId}.`);

    // Emit WebSocket event to update UI in real-time
    // 'io' needs to be available in this scope.
    // This typically means passing the io instance from app.js to routes/webhooks.js
    // which then needs to be used here. For modularity, the io instance is passed
    // to a separate webhook route handler as shown in the previous app.js example.
    // If you integrate this PUT route directly here, you'd need `io` in this file's scope.
    // Let's assume you've structured it such that `io` is accessible.
    // For this example, we'll assume `io` comes from `webhookRoutes.setSocketIO(io);` setup.

    // A more robust solution would be to have a dedicated webhook route (e.g., in routes/webhooks.js)
    // that handles this specific n8n callback and has access to the `io` instance.
    // If you are keeping it here, you'd need to pass 'io' into this router's scope.
    // For now, let's assume this PUT route is part of a separate webhook module where `io` is set.
    // Example: const { io } = require('../app'); // This would be circular, bad practice.
    // Best practice is the `setSocketIO` approach for webhookRoutes.
    // So, this PUT route SHOULD be in a separate `routes/webhooks.js` file.

    // Given the prompt asks for this PUT in tickets.js, if you move it, adjust accordingly.
    // For this example, if it *must* stay here, you'd need to pass `io` to this file.
    // However, for clean separation and direct fulfillment of `webhookRoutes.setSocketIO(io);`,
    // it's better placed in a `webhooks.js` file.
    // I'm providing this placeholder. You should ensure the Socket.IO emit works from where
    // this logic actually lives and has access to the `io` instance.

    // To make this route emit a socket event if it *must* be in tickets.js,
    // you'd need a way to inject the `io` instance here.
    // A common pattern for this is to export a function from app.js that configures routes,
    // and passes `io` to them, or to use a global object (less recommended).
    // For the prompt, I'll stick to the idea that the `webhook/ticket-done`
    // route will handle the emit, which should ideally be in its own file.

    res.status(200).send('Ticket status updated successfully.');

  } catch (error) {
    console.error('Error updating ticket status from webhook:', error);
    res.status(500).send('Internal Server Error: Could not update ticket status.');
  }
});


module.exports = router;
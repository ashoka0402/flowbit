const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User'); // Assuming User model is available
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const supertest = require('supertest');
const express = require('express'); // To create a mock Express app

// Mock Express app to test middleware
const app = express();
app.use(express.json());
// Attach mocked middleware and routes
app.get('/test/tickets', authenticateToken, async (req, res) => {
    try {
        const tickets = await Ticket.find({ customerId: req.user.customerId });
        res.json(tickets);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Dummy JWT secret for tests
process.env.JWT_SECRET = 'testsecret';

describe('Tenant Data Isolation for Tickets', () => {
    beforeAll(async () => {
        // Use an in-memory database for testing or connect to a dedicated test DB
        await mongoose.connect(process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/flowbit_test', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
    });

    afterEach(async () => {
        await Ticket.deleteMany({}); // Clean up after each test
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    it('Admin from Tenant A should NOT be able to read Tenant B\'s data', async () => {
        // Create tickets for Tenant A
        await Ticket.create({ title: 'A-Ticket 1', description: 'Desc A1', customerId: 'TenantA', status: 'Open' });
        await Ticket.create({ title: 'A-Ticket 2', description: 'Desc A2', customerId: 'TenantA', status: 'Open' });

        // Create tickets for Tenant B
        await Ticket.create({ title: 'B-Ticket 1', description: 'Desc B1', customerId: 'TenantB', status: 'Open' });
        await Ticket.create({ title: 'B-Ticket 2', description: 'Desc B2', customerId: 'TenantB', status: 'Open' });

        // Create an Admin user for Tenant A
        const userA = await User.create({ email: 'adminA@a.com', password: 'password', customerId: 'TenantA', role: 'Admin' });
        const tokenA = jwt.sign({ id: userA._id, customerId: userA.customerId, role: userA.role }, process.env.JWT_SECRET);

        // Simulate request from Tenant A Admin
        const response = await supertest(app)
            .get('/test/tickets')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(response.statusCode).toEqual(200);
        expect(response.body.length).toEqual(2); // Should only see Tenant A's tickets
        expect(response.body.some(t => t.customerId === 'TenantB')).toBeFalsy(); // Should not contain Tenant B's tickets
        expect(response.body[0].title).toMatch(/A-Ticket/);
    });

    it('User from Tenant B should only see their own tickets', async () => {
        // Create tickets for Tenant A
        await Ticket.create({ title: 'A-Ticket 1', description: 'Desc A1', customerId: 'TenantA', status: 'Open' });

        // Create tickets for Tenant B
        await Ticket.create({ title: 'B-Ticket 1', description: 'Desc B1', customerId: 'TenantB', status: 'Open' });
        await Ticket.create({ title: 'B-Ticket 2', description: 'Desc B2', customerId: 'TenantB', status: 'Open' });

        // Create a User for Tenant B
        const userB = await User.create({ email: 'userB@b.com', password: 'password', customerId: 'TenantB', role: 'User' });
        const tokenB = jwt.sign({ id: userB._id, customerId: userB.customerId, role: userB.role }, process.env.JWT_SECRET);

        // Simulate request from Tenant B User
        const response = await supertest(app)
            .get('/test/tickets')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(response.statusCode).toEqual(200);
        expect(response.body.length).toEqual(2); // Should only see Tenant B's tickets
        expect(response.body.every(t => t.customerId === 'TenantB')).toBeTruthy();
    });
});
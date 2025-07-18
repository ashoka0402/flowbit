require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedUsers = [
  {
    email: 'admin@logisticsco.com',
    password: 'password123',
    customerId: 'LogisticsCo',
    role: 'Admin',
  },
  {
    email: 'user@logisticsco.com',
    password: 'password123',
    customerId: 'LogisticsCo',
    role: 'User',
  },
  {
    email: 'admin@retailgmbh.com',
    password: 'password123',
    customerId: 'RetailGmbH',
    role: 'Admin',
  },
  {
    email: 'user@retailgmbh.com',
    password: 'password123',
    customerId: 'RetailGmbH',
    role: 'User',
  },
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/flowbit', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for seeding.');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users.');

    // Hash passwords and insert
    for (const userData of seedUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({ ...userData, password: hashedPassword });
    }

    console.log('Database seeded successfully with tenants and users.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();
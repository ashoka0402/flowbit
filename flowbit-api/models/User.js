const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  customerId: { type: String, required: true }, // Crucial for tenant isolation
  role: { type: String, enum: ['Admin', 'User'], default: 'User' },
});

module.exports = mongoose.model('User', userSchema);
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const registryPath = path.join(__dirname, '../registry.json');
let registryData = [];
try {
  registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
} catch (error) {
  console.error('Error reading registry.json:', error.message);
}

router.get('/me/screens', authenticateToken, (req, res) => {
  const customerId = req.user.customerId;
  const screensForTenant = registryData.filter(
    (entry) => entry.tenantId === customerId
  );
  res.json(screensForTenant);
});

module.exports = router;
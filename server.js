// server.js — demo Node server to store subscriptions and send test push

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

// --- VAPID keys (replace with your own or use the ones included here) ---
const VAPID_PUBLIC_KEY = 'BHCiV7I9qgq2eZ9mF7uYXZB9MZC8yI3qT1fS3KpG8vZ3J0e2o0szZlZ2VXz0gH1bT6i2U7sZ2pE6qYbI2fw';
const VAPID_PRIVATE_KEY = 'dOe2lQmQ1z6pY9WQ3w5eB2fT8cS1mA0uLhKpV9cQ2eI';
const CONTACT_EMAIL = 'gushumani@gmail.com'; // change to your contact email

webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// In-memory subscription store (demo). Use a DB in production.
const subscriptions = new Map();

// Endpoint to return public VAPID key to the client
app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save subscription sent by client
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  subscriptions.set(subscription.endpoint, subscription);
  console.log('Saved subscription:', subscription.endpoint);
  res.json({ ok: true });
});

// Send test push to all stored subscriptions
app.post('/api/send-test', async (req, res) => {
  const payload = JSON.stringify({
    title: 'Test Notification',
    body: 'This is a test push from your server.',
    icon: '/icons/custom-notification-icon.png',
    data: { path: '/posts/timebucks/' }
  });

  const results = [];
  for (const [endpoint, sub] of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint, status: 'sent' });
    } catch (err) {
      console.error('Push error for', endpoint, err);
      results.push({ endpoint, status: 'error', error: err.message });
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions.delete(endpoint);
      }
    }
  }

  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

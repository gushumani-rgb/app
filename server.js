// server.js — Watch posts folder and push to all subscribers
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

// Serve static files from root (posts/, images/, icons/, sw.js, index.html, etc.)
app.use(express.static(__dirname));

// --- VAPID keys (replace with your own) ---
const VAPID_PUBLIC_KEY = 'BHCiV7I9qgq2eZ9mF7uYXZB9MZC8yI3qT1fS3KpG8vZ3J0e2o0szZlZ2VXz0gH1bT6i2U7sZ2pE6qYbI2fw';
const VAPID_PRIVATE_KEY = 'dOe2lQmQ1z6pY9WQ3w5eB2fT8cS1mA0uLhKpV9cQ2eI';
const CONTACT_EMAIL = 'mailto:you@example.com';

webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Store subscriptions ---
const subscriptions = new Map();

// Return VAPID public key
app.get('/vapidPublicKey', (req, res) => res.json({ publicKey: VAPID_PUBLIC_KEY }));

// Save subscription from any client (browser or PWA)
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  subscriptions.set(subscription.endpoint, subscription);
  console.log('Saved subscription:', subscription.endpoint);
  res.json({ ok: true });
});

// Send push to all subscriptions
async function sendPush(payload) {
  for (const [endpoint, sub] of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      console.error('Push error for', endpoint, err.message);
      if (err.statusCode === 410 || err.statusCode === 404) subscriptions.delete(endpoint);
    }
  }
}

// --- Watch posts folder in root ---
const postsFolder = path.join(__dirname, 'posts');
let knownPosts = new Set();

// Load existing post folders on startup
fs.readdir(postsFolder, { withFileTypes: true }, (err, files) => {
  if (!err) {
    files.filter(f => f.isDirectory()).forEach(dir => knownPosts.add(dir.name));
  }
});

// Watch for new post folders
fs.watch(postsFolder, async (eventType, folderName) => {
  if (!folderName) return;

  const folderPath = path.join(postsFolder, folderName);

  if (!knownPosts.has(folderName) && fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
    knownPosts.add(folderName);
    console.log('New post detected:', folderName);

    const indexFile = path.join(folderPath, 'index.html');
    let title = 'Untitled';
    let summary = 'Check out our latest post!';
    let image = '/icons/custom-notification-icon.png';

    try {
      const html = fs.readFileSync(indexFile, 'utf8');

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();

      const summaryMatch = html.match(/<p>(.*?)<\/p>/i);
      if (summaryMatch) summary = summaryMatch[1].trim();

      const imgMatch = html.match(/<img.*?src=["'](.*?)["']/i);
      if (imgMatch) image = imgMatch[1];

      const ytMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/) || html.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (ytMatch) image = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;

    } catch (err) {
      console.warn('Failed to read index.html for new post:', err);
    }

    // Push notification payload
    const payload = {
      title: 'New Post: ' + title,
      body: summary,
      icon: image,
      badge: '/icons/notification-badge.png',
      data: { path: `/posts/${folderName}/index.html` }
    };

    await sendPush(payload);
    console.log('Push sent instantly for new post:', folderName);
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

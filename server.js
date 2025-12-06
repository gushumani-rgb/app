// server.js — Push only to installed PWA users with thumbnails
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static('public')); // serve your HTML and sw.js

// --- VAPID keys (replace with your own) ---
const VAPID_PUBLIC_KEY = 'BHCiV7I9qgq2eZ9mF7uYXZB9MZC8yI3qT1fS3KpG8vZ3J0e2o0szZlZ2VXz0gH1bT6i2U7sZ2pE6qYbI2fw';
const VAPID_PRIVATE_KEY = 'dOe2lQmQ1z6pY9WQ3w5eB2fT8cS1mA0uLhKpV9cQ2eI';
const CONTACT_EMAIL = 'mailto:you@example.com';

webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Store subscriptions ---
const subscriptions = new Map();

// Return VAPID public key
app.get('/vapidPublicKey', (req, res) => res.json({ publicKey: VAPID_PUBLIC_KEY }));

// Save subscription from installed PWA only
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  subscriptions.set(subscription.endpoint, subscription);
  console.log('Saved PWA subscription:', subscription.endpoint);
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

// Extract YouTube thumbnail
function getYouTubeThumbnail(link) {
  if (!link) return null;
  const matchEmbed = link.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (matchEmbed) return `https://img.youtube.com/vi/${matchEmbed[1]}/hqdefault.jpg`;
  const matchShort = link.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (matchShort) return `https://img.youtube.com/vi/${matchShort[1]}/hqdefault.jpg`;
  if (link.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(link.split('?')[1] || '');
    const v = urlParams.get('v');
    if (v) return `https://img.youtube.com/vi/${v}/hqdefault.jpg`;
  }
  return null;
}

// Watch posts JSON file for new posts
const postsFile = path.join(__dirname, 'public/index.json');
let knownPosts = new Set();

fs.readFile(postsFile, 'utf8', (err, data) => {
  if (!err) {
    try {
      const posts = JSON.parse(data);
      posts.forEach(p => knownPosts.add(p.id || p.path || p.title));
    } catch (e) {}
  }
});

fs.watchFile(postsFile, async () => {
  try {
    const posts = JSON.parse(fs.readFileSync(postsFile, 'utf8'));
    for (const post of posts) {
      const postId = post.id || post.path || post.title;
      if (!knownPosts.has(postId)) {
        knownPosts.add(postId);
        console.log('New post detected:', post.title);

        // Choose image: YouTube thumbnail > featured image
        const image = getYouTubeThumbnail(post.link) || post.featuredImage || post.image || '/icons/custom-notification-icon.png';

        // Push payload
        const payload = {
          title: 'New Post: ' + (post.title || 'Untitled'),
          body: post.summary || 'Check out our latest post!',
          icon: image,
          badge: '/icons/notification-badge.png',
          data: { path: post.link || post.path || '/' }
        };

        await sendPush(payload);
        console.log('Push sent with thumbnail for:', post.title);
      }
    }
  } catch (err) {
    console.error('Error watching posts:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

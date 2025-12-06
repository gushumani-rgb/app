const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// --- VAPID keys & email ---
const VAPID_PUBLIC_KEY = 'BHCiV7I9qgq2eZ9mF7uYXZB9MZC8yI3qT1fS3KpG8vZ3J0e2o0szZlZ2VXz0gH1bT6i2U7sZ2pE6qYbI2fw';
const VAPID_PRIVATE_KEY = 'dOe2lQmQ1z6pY9WQ3w5eB2fT8cS1mA0uLhKpV9cQ2eI';
const CONTACT_EMAIL = 'mailto:gushumani@gmail.com';

webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Subscriptions ---
const SUB_FILE = path.join(__dirname, 'subscriptions.json');
const subscriptions = new Map();

function readSubsFile() {
  try {
    if (!fs.existsSync(SUB_FILE)) return {};
    return JSON.parse(fs.readFileSync(SUB_FILE, 'utf8') || '{}');
  } catch (err) {
    console.error('Failed to read subscriptions.json:', err);
    return {};
  }
}

function writeSubsFile(obj) {
  try {
    fs.writeFileSync(SUB_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to write subscriptions.json:', err);
  }
}

// Seed subscriptions
Object.entries(readSubsFile()).forEach(([k, v]) => subscriptions.set(k, v));

// --- Save subscription ---
app.post('/api/save-subscription', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  subscriptions.set(sub.endpoint, sub);
  writeSubsFile(Object.fromEntries(subscriptions));
  console.log('Saved subscription:', sub.endpoint);
  res.json({ ok: true });
});

// --- VAPID public key endpoint ---
app.get('/vapidPublicKey', (req, res) => res.json({ publicKey: VAPID_PUBLIC_KEY }));

// --- Send push to all subscribers ---
async function sendPushToAll(payload) {
  const results = [];
  for (const sub of subscriptions.values()) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      results.push({ endpoint: sub.endpoint, status: 'ok' });
    } catch (err) {
      console.warn('Push failed:', err.statusCode, err.message);
      results.push({ endpoint: sub.endpoint, status: 'failed', error: err.message });
      if (err.statusCode === 404 || err.statusCode === 410) {
        subscriptions.delete(sub.endpoint);
      }
    }
  }
  writeSubsFile(Object.fromEntries(subscriptions));
  return results;
}

// --- Posts watcher ---
const postsFolder = path.join(__dirname, 'posts');
if (!fs.existsSync(postsFolder)) fs.mkdirSync(postsFolder, { recursive: true });

const knownPosts = new Set();
fs.readdirSync(postsFolder, { withFileTypes: true }).forEach(f => {
  if (f.isDirectory() || (f.isFile() && f.name.endsWith('.html'))) knownPosts.add(f.name);
});

const watcher = chokidar.watch(postsFolder, {
  ignoreInitial: true,
  depth: 1,
  awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

// --- Handle new post ---
async function handleNewPost(fullPath, isFolder = false) {
  const name = path.basename(fullPath);
  if (knownPosts.has(name)) return;
  knownPosts.add(name);
  console.log('New post detected:', name);

  let title = 'Untitled';
  let summary = 'Check out our latest post!';
  let image = '/icons/notification-badge.png';
  let htmlPath;

  if (isFolder) {
    htmlPath = `/posts/${name}/index.html`;
    const jsonFile = path.join(fullPath, 'index.json');
    try {
      if (fs.existsSync(jsonFile)) {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        if (data.title) title = data.title;
        if (data.excerpt) summary = data.excerpt;
        if (data.featuredImage) image = data.featuredImage;
      }
    } catch (err) {
      console.warn('Failed to read index.json for folder', name, err);
    }
  } else { // single HTML file
    htmlPath = `/posts/${name}`;
    const jsonFile = fullPath.replace(/\.html$/, '.json');
    let jsonLoaded = false;

    try {
      if (fs.existsSync(jsonFile)) {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        if (data.title) title = data.title;
        if (data.excerpt) summary = data.excerpt;
        if (data.featuredImage) image = data.featuredImage;
        jsonLoaded = true;
      }
    } catch (err) {
      console.warn('Failed to read JSON for file', name, err);
    }

    // Extract <title> from HTML if no JSON title
    if (!jsonLoaded || title === 'Untitled') {
      try {
        const htmlContent = fs.readFileSync(fullPath, 'utf8');
        const match = htmlContent.match(/<title>(.*?)<\/title>/i);
        if (match && match[1]) title = match[1].trim();
      } catch (err) {
        console.warn('Failed to extract title from HTML for', name, err);
      }
    }
  }

  const payload = {
    title: 'New Post: ' + title,
    body: summary,
    icon: image,
    badge: '/icons/notification-badge.png',
    data: { path: htmlPath },
    tag: 'new-post'
  };

  try {
    const result = await sendPushToAll(payload);
    console.log('Push sent for post:', name, 'results:', result.length);
  } catch (err) {
    console.error('Error sending push for post:', name, err);
  }
}

// Watch for new folders
watcher.on('addDir', dirPath => handleNewPost(dirPath, true));

// Watch for new HTML files
watcher.on('add', filePath => {
  if (!filePath.endsWith('.html')) return;
  handleNewPost(filePath, false);
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

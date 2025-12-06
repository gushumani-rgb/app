// server.js — Watch posts folder and push to all PWA subscribers (improved)
const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

// Serve static files (posts/, icons/, sw.js, index.html, etc.)
app.use(express.static(__dirname));

// --- VAPID keys (prefer environment variables) ---
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHCiV7I9qgq2eZ9mF7uYXZB9MZC8yI3qT1fS3KpG8vZ3J0e2o0szZlZ2VXz0gH1bT6i2U7sZ2pE6qYbI2fw';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'dOe2lQmQ1z6pY9WQ3w5eB2fT8cS1mA0uLhKpV9cQ2eI';
const CONTACT_EMAIL = process.env.VAPID_CONTACT || 'mailto:gushumani@gmail.com;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('Warning: Missing VAPID keys. Generate them with: npx web-push generate-vapid-keys');
}

webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// --- Subscription persistence (file-backed) ---
const SUB_FILE = path.join(__dirname, 'subscriptions.json');

function readSubsFile() {
  try {
    if (!fs.existsSync(SUB_FILE)) return {};
    const raw = fs.readFileSync(SUB_FILE, 'utf8') || '{}';
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read subscriptions file:', err);
    return {};
  }
}
function writeSubsFile(obj) {
  try {
    fs.writeFileSync(SUB_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to write subscriptions file:', err);
  }
}

// In-memory Map for fast ops, seeded from file
const subscriptions = new Map(Object.entries(readSubsFile())); // key: endpoint -> value: subscription object

// persist on exit (best-effort)
process.on('SIGINT', () => {
  writeSubsFile(Object.fromEntries(subscriptions));
  process.exit();
});
process.on('SIGTERM', () => {
  writeSubsFile(Object.fromEntries(subscriptions));
  process.exit();
});

// Return VAPID public key
app.get('/vapidPublicKey', (req, res) => res.json({ publicKey: VAPID_PUBLIC_KEY }));

// Save subscription from PWA (auto-subscribe)
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  subscriptions.set(subscription.endpoint, subscription);
  // persist to file
  writeSubsFile(Object.fromEntries(subscriptions));

  console.log('Saved subscription:', subscription.endpoint);
  res.json({ ok: true });
});

// Unsubscribe (client should call this when it unsubscribes)
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });

  const existed = subscriptions.delete(endpoint);
  writeSubsFile(Object.fromEntries(subscriptions));
  console.log('Unsubscribed:', endpoint, 'existed?', existed);
  res.json({ ok: true });
});

// Send test notification to all subs (POST body can contain custom payload)
app.post('/api/send-test', async (req, res) => {
  const payload = req.body && Object.keys(req.body).length ? req.body : {
    title: 'Test Notification',
    body: 'This is a server-generated test notification.',
    icon: '/icons/notification-badge.png',
    badge: '/icons/notification-badge.png',
    data: { path: '/' }
  };

  try {
    const result = await sendPushToAll(payload);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('Error sending test:', err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

// --- sendPush implementation (batched + error cleanup) ---
async function sendPushBatch(subArray, payload) {
  // returns array of { endpoint, status, error? }
  const tasks = subArray.map(sub => {
    return webpush.sendNotification(sub, JSON.stringify(payload))
      .then(() => ({ endpoint: sub.endpoint, status: 'ok' }))
      .catch(err => ({ endpoint: sub.endpoint, status: 'failed', statusCode: err.statusCode || null, message: err.body || err.message || String(err) }));
  });
  return Promise.allSettled(tasks).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { status: 'failed', reason: r.reason }));
}

async function sendPushToAll(payload, batchSize = 20) {
  const subs = Array.from(subscriptions.values());
  const results = [];
  for (let i = 0; i < subs.length; i += batchSize) {
    const batch = subs.slice(i, i + batchSize);
    // run send in parallel for this batch
    const batchResults = await sendPushBatch(batch, payload);

    // handle cleanup for failures that are permanent
    for (const r of batchResults) {
      if (!r || r.status !== 'ok') {
        const endpoint = r.endpoint;
        // try to parse statusCode; on 410/404 remove subscription
        if (r.statusCode === 410 || r.statusCode === 404) {
          subscriptions.delete(endpoint);
          console.log('Removed expired subscription:', endpoint);
        } else {
          console.warn('Push failed for', endpoint, r.statusCode, r.message);
        }
        results.push(r);
      } else {
        results.push(r);
      }
    }
  }
  // persist current subs (after cleanup)
  writeSubsFile(Object.fromEntries(subscriptions));
  return results;
}

// --- Watch posts folder for new posts using chokidar ---
const postsFolder = path.join(__dirname, 'posts');
const knownPosts = new Set();

// ensure posts folder exists
if (!fs.existsSync(postsFolder)) {
  fs.mkdirSync(postsFolder, { recursive: true });
}

// Seed known posts from existing directories
try {
  const files = fs.readdirSync(postsFolder, { withFileTypes: true });
  files.filter(f => f.isDirectory()).forEach(dir => knownPosts.add(dir.name));
} catch (err) {
  console.error('Failed to read posts folder:', err);
}

// Watch for new directories (new posts)
const watcher = chokidar.watch(postsFolder, {
  ignoreInitial: true,
  depth: 1,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

// --- New post watcher ---
watcher.on('addDir', async (dirPath) => {
  const folderName = path.basename(dirPath);
  if (knownPosts.has(folderName)) return;
  knownPosts.add(folderName);
  console.log('New post folder detected:', folderName);

  // default metadata
  let title = 'Untitled';
  let summary = 'Check out our latest post!';
  let image = '/icons/notification-badge.png';

  const jsonFile = path.join(dirPath, 'index.json');
  try {
    if (fs.existsSync(jsonFile)) {
      const raw = fs.readFileSync(jsonFile, 'utf8');
      const data = JSON.parse(raw);

      if (data.title) title = data.title;
      if (data.excerpt) summary = data.excerpt;             // matches your index.json
      if (data.featuredImage) image = data.featuredImage;  // matches your index.json
    }
  } catch (err) {
    console.warn('Failed to read index.json for', folderName, err);
  }

  const htmlFilePath = `/posts/${folderName}/index.html`;
  const payload = {
    title: 'New Post: ' + title,
    body: summary,
    icon: image,
    badge: '/icons/notification-badge.png',
    data: { path: htmlFilePath },
    tag: 'new-post'
  };

  try {
    const sendResult = await sendPushToAll(payload);
    console.log('Push sent for new post:', folderName, 'results:', sendResult.length);
  } catch (err) {
    console.error('Error sending push for new post:', err);
  }
});

// Optional: watch for new single-file posts under /posts/*.html
watcher.on('add', async (filePath) => {
  // implement logic if you publish single-file posts directly
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`VAPID Public Key (serve to clients): ${VAPID_PUBLIC_KEY}`);
});

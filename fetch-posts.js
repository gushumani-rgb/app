// fetch-posts.js (JSONP-safe, debug version)
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Config
const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const OUTPUT_DIR = path.join(__dirname, 'posts');
const BLOG_TITLE = 'Work From Anywhere';

// Ensure posts folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('[DEBUG] Created folder:', OUTPUT_DIR);
} else {
  console.log('[DEBUG] Folder exists:', OUTPUT_DIR);
}
console.log('[DEBUG] Posts folder exists now:', fs.existsSync(OUTPUT_DIR));

// Helpers
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function hash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function slugify(title) {
  return title
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: safely parse JSON or strip JSONP wrapper
function parseBloggerJSON(body) {
  let jsonText = body.trim();
  // Detect JSONP wrapper
  const jsonpMatch = jsonText.match(/^[^(]*\(([\s\S]*)\);?$/);
  if (jsonpMatch) {
    jsonText = jsonpMatch[1];
    console.log('[DEBUG] JSONP wrapper detected and removed');
  }
  return JSON.parse(jsonText);
}

// Main function
(async () => {
  try {
    console.log('[DEBUG] Fetching Blogger feed:', BLOG_JSON);
    const res = await fetch(BLOG_JSON, { redirect: 'follow' });
    console.log('[DEBUG] Response status:', res.status);

    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);

    const body = await res.text();
    const data = parseBloggerJSON(body);

    console.log('[DEBUG] Feed keys:', Object.keys(data.feed || {}));
    console.log('[DEBUG] feed.entry exists:', Array.isArray(data.feed.entry));

    if (!data.feed || !data.feed.entry || data.feed.entry.length === 0) {
      console.log('[DEBUG] No posts found in feed.');
      const placeholder = path.join(OUTPUT_DIR, 'no-posts.html');
      fs.writeFileSync(placeholder, `<html><body><h1>No posts found</h1></body></html>`);
      console.log('[DEBUG] Placeholder created:', placeholder);
      return;
    }

    const posts = data.feed.entry;
    console.log('[DEBUG] Posts fetched:', posts.length);

    const currentFiles = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
    console.log('[DEBUG] Current files in posts folder:', currentFiles);

    const activeFiles = [];
    let updated = false;

    for (const post of posts) {
      const title = post.title?.$t || 'untitled';
      const titleSlug = slugify(title);
      const content = post.content?.$t || '';
      const author = post.author?.[0]?.name?.$t || 'Unknown';
      const published = post.published ? formatDate(post.published.$t) : 'Unknown date';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | ${BLOG_TITLE}</title>
</head>
<body>
<h1>${title}</h1>
<p><em>Blog: ${BLOG_TITLE}</em></p>
<p><strong>Author:</strong> ${author} | <strong>Published:</strong> ${published}</p>
<hr>
${content}
</body>
</html>`;

      const filePath = path.join(OUTPUT_DIR, `${titleSlug}.html`);
      activeFiles.push(`${titleSlug}.html`);

      let writeFile = true;
      if (fs.existsSync(filePath)) {
        const existingHash = hash(fs.readFileSync(filePath, 'utf8'));
        const newHash = hash(html);
        if (existingHash === newHash) writeFile = false;
      }

      if (writeFile) {
        fs.writeFileSync(filePath, html, 'utf8');
        console.log('[DEBUG] Saved/Updated:', `${titleSlug}.html`);
        updated = true;
      }
    }

    // Remove deleted posts
    for (const file of currentFiles) {
      if (!activeFiles.includes(file)) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        console.log('[DEBUG] Deleted:', file);
        updated = true;
      }
    }

    if (!updated) console.log('[DEBUG] No changes detected.');
    console.log('[DEBUG] Final files in posts folder:', fs.readdirSync(OUTPUT_DIR));

  } catch (err) {
    console.error('[ERROR] Fetching or processing posts failed:', err);
  }
})();

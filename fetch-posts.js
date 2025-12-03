// fetch-posts.js
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
  console.log('Created folder:', OUTPUT_DIR);
} else {
  console.log('Folder exists:', OUTPUT_DIR);
}

// Helper: format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

// Helper: hash content
function hash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// Helper: generate clean URL-friendly slug from title
function slugify(title) {
  return title
    .toString()
    .normalize('NFKD')                   // normalize unicode
    .replace(/[\u0300-\u036f]/g, '')    // remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')        // replace non-alphanumeric with dash
    .replace(/^-+|-+$/g, '');           // remove leading/trailing dashes
}

// Main function
(async () => {
  try {
    console.log('Fetching Blogger feed:', BLOG_JSON);
    const res = await fetch(BLOG_JSON, { redirect: 'follow' });
    console.log('Response status:', res.status);

    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);

    const data = await res.json();

    if (!data.feed || !data.feed.entry) {
      console.log('No posts found in feed.');
      return;
    }

    const posts = data.feed.entry;
    console.log('Posts fetched:', posts.length);

    const currentFiles = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
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
        console.log('Saved/Updated:', `${titleSlug}.html`);
        updated = true;
      }
    }

    // Delete removed posts
    for (const file of currentFiles) {
      if (!activeFiles.includes(file)) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        console.log('Deleted:', file);
        updated = true;
      }
    }

    if (!updated) console.log('No changes detected.');

  } catch (err) {
    console.error('Error fetching or processing posts:', err);
  }
})();

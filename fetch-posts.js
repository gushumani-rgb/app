// fetch-posts.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Config
const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json';
const OUTPUT_DIR = path.join(__dirname, 'posts'); // folder in repo root
const BLOG_TITLE = 'Work From Anywhere';
const MAX_POSTS = 50; // max posts per run

// Ensure posts folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Created folder:', OUTPUT_DIR);
} else {
  console.log('Folder already exists:', OUTPUT_DIR);
}

// Helper functions
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function hash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// Main async function
(async () => {
  try {
    console.log('Fetching JSON feed:', BLOG_JSON);

    // Follow redirects
    const res = await fetch(BLOG_JSON, { redirect: 'follow' });
    console.log('Response status:', res.status);

    if (!res.ok) {
      console.error('Failed to fetch feed:', res.statusText);
      return;
    }

    const data = await res.json();

    if (!data.feed) {
      console.error('Feed data missing');
      return;
    }

    const posts = data.feed.entry || [];
    console.log('Number of posts fetched:', posts.length);

    if (!posts.length) {
      console.log('No posts found, creating placeholder file...');
      const placeholder = path.join(OUTPUT_DIR, 'no-posts.html');
      fs.writeFileSync(placeholder, `<html><body><h1>No posts found</h1></body></html>`);
      return;
    }

    // Limit posts per run
    const postsToProcess = posts.slice(0, MAX_POSTS);

    const currentFiles = fs.existsSync(OUTPUT_DIR)
      ? fs.readdirSync(OUTPUT_DIR)
      : [];
    const activeFiles = [];
    let updated = false;

    for (const post of postsToProcess) {
      const titleSlug = post.title.$t.replace(/[^a-z0-9]/gi,'-').toLowerCase();
      const content = post.content.$t;
      const author = post.author[0].name.$t;
      const published = formatDate(post.published.$t);

      const html = `<!DOCTYPE html>
<html lang='en'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width, initial-scale=1.0'>
<title>${post.title.$t} | ${BLOG_TITLE}</title>
</head>
<body>
<h1>${post.title.$t}</h1>
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
        fs.writeFileSync(filePath, html);
        console.log('Saved/Updated:', filePath);
        updated = true;
      }
    }

    // Remove deleted posts
    for (const file of currentFiles) {
      if (!activeFiles.includes(file)) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        console.log('Deleted:', file);
        updated = true;
      }
    }

    if (!updated) console.log('No changes detected');

  } catch (err) {
    console.error('Error fetching or processing posts:', err);
  }
})();

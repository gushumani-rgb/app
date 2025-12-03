// fetch-posts.js (JSONP-safe with summary)
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Config
const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const OUTPUT_DIR = path.join(__dirname, 'posts');
const BLOG_TITLE = 'Work From Anywhere';

// Ensure posts folder exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

function parseBloggerJSON(body) {
  let jsonText = body.trim();
  const jsonpMatch = jsonText.match(/^[^(]*\(([\s\S]*)\);?$/);
  if (jsonpMatch) jsonText = jsonpMatch[1];
  return JSON.parse(jsonText);
}

// Counters for summary
let createdCount = 0;
let updatedCount = 0;
let deletedCount = 0;

(async () => {
  try {
    const res = await fetch(BLOG_JSON, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);

    const body = await res.text();
    const data = parseBloggerJSON(body);

    const posts = data.feed?.entry || [];
    const totalPosts = posts.length;

    const currentFiles = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
    const activeFiles = [];

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
        if (fs.existsSync(filePath)) {
          createdCount++;
        } else {
          updatedCount++;
        }
      }
    }

    // Remove deleted posts
    for (const file of currentFiles) {
      if (!activeFiles.includes(file)) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
        deletedCount++;
      }
    }

    // Print summary
    console.log("===== POSTS SYNC SUMMARY =====");
    console.log(`Posts created: ${createdCount}`);
    console.log(`Posts updated: ${updatedCount}`);
    console.log(`Posts deleted: ${deletedCount}`);
    console.log(`Total posts: ${totalPosts}`);
    console.log("===== END OF SUMMARY =====");

  } catch (err) {
    console.error('[ERROR] Fetching or processing posts failed:', err);
  }
})();

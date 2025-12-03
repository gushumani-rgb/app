const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Ensure the JSON file is always written in the repo root
const REPO_ROOT = process.cwd(); // Current working directory in workflow
const INDEX_JSON_PATH = path.join(REPO_ROOT, 'index.json');

const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const BLOG_TITLE = 'Work From Anywhere';

// Format date
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Parse Blogger JSON (handles JSONP)
function parseBloggerJSON(body) {
  let jsonText = body.trim();
  const jsonpMatch = jsonText.match(/^[^(]*\(([\s\S]*)\);?$/);
  if (jsonpMatch) jsonText = jsonpMatch[1];
  return JSON.parse(jsonText);
}

(async () => {
  try {
    const res = await fetch(BLOG_JSON, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
    const body = await res.text();
    const data = parseBloggerJSON(body);

    const posts = data.feed?.entry || [];
    posts.sort((a, b) => new Date(b.published.$t) - new Date(a.published.$t));

    // Map posts to simplified JSON
    const postsJson = posts.map(post => ({
      title: post.title?.$t || 'untitled',
      author: post.author?.[0]?.name?.$t || 'Unknown',
      published: post.published ? formatDate(post.published.$t) : 'Unknown date',
      content: post.content?.$t || ''
    }));

    // Write index.json to repo root
    fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(postsJson, null, 2), 'utf8');
    console.log(`[SUCCESS] index.json updated with ${posts.length} posts at ${INDEX_JSON_PATH}`);

  } catch (err) {
    console.error('[ERROR]', err);
  }
})();

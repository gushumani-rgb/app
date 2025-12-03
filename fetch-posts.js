const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Blogger feed URL (max 50 posts)
const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const INDEX_JSON_PATH = path.join(__dirname, 'index.json');
const BLOG_TITLE = 'Work From Anywhere';

// Format date in readable form
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Parse Blogger JSON (handle JSONP if present)
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
    // Sort newest first
    posts.sort((a, b) => new Date(b.published.$t) - new Date(a.published.$t));

    // Create JSON array
    const postsJson = posts.map(post => ({
      title: post.title?.$t || 'untitled',
      author: post.author?.[0]?.name?.$t || 'Unknown',
      published: post.published ? formatDate(post.published.$t) : 'Unknown date',
      content: post.content?.$t || ''
    }));

    // Save JSON
    fs.writeFileSync(INDEX_JSON_PATH, JSON.stringify(postsJson, null, 2), 'utf8');
    console.log(`[SUCCESS] index.json updated with ${posts.length} posts.`);

  } catch (err) {
    console.error('[ERROR]', err);
  }
})();

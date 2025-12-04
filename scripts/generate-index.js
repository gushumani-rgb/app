const fs = require('fs');
const fetch = require('node-fetch'); // install with npm install node-fetch@2
const path = require('path');

const BLOG_FEED = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json';
const INDEX_FILE = path.join(__dirname, '../index.json');

async function buildIndex() {
  try {
    const res = await fetch(BLOG_FEED);
    if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
    
    const data = await res.json();
    const entries = data.feed.entry || [];

    const posts = entries.map(entry => {
      // Title
      const title = entry.title?.$t || 'Untitled';

      // Link
      const link = entry.link?.find(l => l.rel === 'alternate')?.href || '';

      // Published date
      const date = entry.published?.$t || null;

      // Summary / snippet
      const summary = entry.summary?.$t || '';

      return { title, link, date, summary };
    });

    // Sort by date descending
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(INDEX_FILE, JSON.stringify(posts, null, 2));
    console.log(`✅ index.json generated successfully with ${posts.length} posts.`);
  } catch (err) {
    console.error('❌ Error generating index.json:', err);
  }
}

buildIndex();

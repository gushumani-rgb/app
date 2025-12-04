const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch@2

const BLOG_FEED = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json';
const INDEX_FILE = path.join(__dirname, '../index.json'); // root of repo

async function buildIndex() {
  let posts = [];

  try {
    const res = await fetch(BLOG_FEED);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const entries = data.feed.entry || [];

    posts = entries.map(entry => ({
      title: entry.title?.$t || 'Untitled',
      link: entry.link?.find(l => l.rel === 'alternate')?.href || '',
      date: entry.published?.$t || null,
      summary: entry.summary?.$t || ''
    }));

    // Sort by date descending
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log(`✅ Fetched ${posts.length} posts from Blogger feed.`);
  } catch (err) {
    console.error('❌ Error fetching Blogger feed:', err);
    console.log('⚠️ Creating empty index.json instead.');
  }

  // Always write index.json (even if empty)
  fs.writeFileSync(INDEX_FILE, JSON.stringify(posts, null, 2));
  console.log(`✅ index.json generated at ${INDEX_FILE}`);
}

buildIndex();

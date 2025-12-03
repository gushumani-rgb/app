const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const INDEX_HTML_PATH = path.join(__dirname, 'index.html');
const INDEX_JSON_PATH = path.join(__dirname, 'index.json');
const BLOG_TITLE = 'Work From Anywhere';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

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

    // Optional: keep minimal index.html template
    if (!fs.existsSync(INDEX_HTML_PATH)) {
      const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${BLOG_TITLE}</title>
<style>
body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: auto; }
article { margin-bottom: 40px; }
h2 { margin-bottom: 5px; }
hr { margin: 15px 0; }
</style>
</head>
<body>
<h1>${BLOG_TITLE}</h1>
<p>Total posts: <span id="total-posts">0</span></p>
<div id="posts"></div>

<script>
fetch('index.json')
  .then(res => res.json())
  .then(posts => {
    document.getElementById('total-posts').textContent = posts.length;
    const container = document.getElementById('posts');
    posts.forEach(p => {
      const art = document.createElement('article');
      art.innerHTML = \`<h2>\${p.title}</h2>
<p><strong>Author:</strong> \${p.author} | <strong>Published:</strong> \${p.published}</p>
<hr>
\${p.content}\`;
      container.appendChild(art);
    });
  });
</script>

</body>
</html>`;
      fs.writeFileSync(INDEX_HTML_PATH, htmlTemplate, 'utf8');
    }

  } catch (err) {
    console.error('[ERROR]', err);
  }
})();

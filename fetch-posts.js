const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BLOG_JSON = 'https://thabogushumani.blogspot.com/feeds/posts/default?alt=json&max-results=50';
const INDEX_PATH = path.join(__dirname, 'index.html');
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

    const postsHtml = posts.map(post => {
      const title = post.title?.$t || 'untitled';
      const author = post.author?.[0]?.name?.$t || 'Unknown';
      const published = post.published ? formatDate(post.published.$t) : 'Unknown date';
      const content = post.content?.$t || '';
      return `<article>
<h2>${title}</h2>
<p><strong>Author:</strong> ${author} | <strong>Published:</strong> ${published}</p>
<hr>
${content}
</article>`;
    }).join('\n');

    const indexHtml = `<!DOCTYPE html>
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
<p>Total posts: ${posts.length}</p>
${postsHtml}
</body>
</html>`;

    fs.writeFileSync(INDEX_PATH, indexHtml, 'utf8');
    console.log(`[SUCCESS] index.html updated with ${posts.length} posts.`);
  } catch (err) {
    console.error('[ERROR] Fetching or processing posts failed:', err);
  }
})();

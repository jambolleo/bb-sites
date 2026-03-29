/* @meta
{
  "name": "chiphell/post",
  "description": "获取 Chiphell 帖子详情和回复",
  "domain": "www.chiphell.com",
  "args": {
    "tid": {"required": true, "description": "Thread/Post ID"}
  },
  "readOnly": true,
  "example": "bb-browser site chiphell/post 2791430"
}
*/

async function(args) {
  if (!args.tid) return {error: 'Missing argument: tid', hint: 'Provide thread ID'};

  const resp = await fetch(`https://www.chiphell.com/thread-${args.tid}-1-1.html`, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Thread not found'};

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Detect login wall
  const msgEl = doc.querySelector('#messagetext');
  if (msgEl && msgEl.textContent.includes('尚未登录')) {
    return {error: 'Not logged in', hint: 'Please log in to Chiphell first'};
  }

  // Get thread title
  const titleEl = doc.querySelector('#thread_subject') || doc.querySelector('.ts');
  const title = titleEl?.textContent.trim() || '';

  // Main post: first div[id^="post_"] inside #postlist
  // (the first children are TABLE elements for thread header/ads, not posts)
  const mainPost = doc.querySelector('#postlist div[id^="post_"]');
  if (!mainPost) return {error: 'Post not found', hint: 'Thread may be deleted or inaccessible'};

  const mainPlc = mainPost.querySelector('.plc');

  // Author: in .pls sidebar, .authi a.xw1
  const author = mainPost.querySelector('.pls .authi a.xw1')?.textContent.trim() || '';

  // Post time: in .plc .authi em
  const postTimeEl = mainPlc?.querySelector('.authi em');
  const postTime = postTimeEl?.textContent.replace(/^发表于\s*/, '').trim() || '';

  // Content: .t_f is the Discuz! X3.5 post message class
  const contentEl = mainPlc?.querySelector('.t_f') || mainPlc?.querySelector('.pct');
  const content = contentEl?.textContent.trim() || '';

  // Get images in main post
  const images = [];
  contentEl?.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('zoomfile') || img.getAttribute('file') || img.getAttribute('src') || '';
    if (src && !src.includes('smilies') && !src.includes('emoticon') && !src.includes('static/image/common')) {
      images.push(src);
    }
  });

  // Get replies: subsequent div[id^="post_"] blocks
  const replies = [];
  const postBlocks = doc.querySelectorAll('#postlist div[id^="post_"]');
  postBlocks.forEach((block, i) => {
    if (i === 0) return; // Skip main post

    const plc = block.querySelector('.plc');
    const replyAuthor = block.querySelector('.pls .authi a.xw1')?.textContent.trim() || '';
    const replyTimeEl = plc?.querySelector('.authi em');
    const replyTime = replyTimeEl?.textContent.replace(/^发表于\s*/, '').trim() || '';
    const replyContentEl = plc?.querySelector('.t_f') || plc?.querySelector('.pct');
    const replyContent = replyContentEl?.textContent.trim() || '';

    // Get images in reply
    const replyImages = [];
    replyContentEl?.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('zoomfile') || img.getAttribute('file') || img.getAttribute('src') || '';
      if (src && !src.includes('smilies') && !src.includes('emoticon') && !src.includes('static/image/common')) {
        replyImages.push(src);
      }
    });

    if (replyContent) {
      replies.push({
        floor: i,
        author: replyAuthor,
        time: replyTime,
        content: replyContent.substring(0, 500),
        images: replyImages.slice(0, 5)
      });
    }
  });

  // Get pagination
  const paginationEl = doc.querySelector('.pg');
  let totalPages = 1;
  if (paginationEl) {
    const labelSpan = paginationEl.querySelector('span[title]');
    if (labelSpan) {
      const pageMatch = labelSpan.getAttribute('title').match(/(\d+)/);
      if (pageMatch) totalPages = parseInt(pageMatch[1]);
    } else {
      const lastLink = paginationEl.querySelector('a.last');
      if (lastLink) {
        totalPages = parseInt(lastLink.textContent.trim()) || totalPages;
      } else {
        paginationEl.querySelectorAll('a').forEach(a => {
          const num = parseInt(a.textContent.trim());
          if (num > totalPages) totalPages = num;
        });
      }
    }
  }

  return {
    tid: args.tid,
    title,
    author,
    postTime,
    content: content.substring(0, 1000),
    images: images.slice(0, 10),
    replyCount: replies.length,
    totalPages,
    replies: replies.slice(0, 20)
  };
}

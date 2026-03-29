/* @meta
{
  "name": "chiphell/posts",
  "description": "获取 Chiphell 论坛帖子列表",
  "domain": "www.chiphell.com",
  "args": {
    "fid": {"required": false, "description": "Forum ID (default: 26, 玩家出售发布区)"},
    "page": {"required": false, "description": "Page number (default: 1)"},
    "filter": {"required": false, "description": "Filter: all, digest, heat, hot (default: all)"}
  },
  "readOnly": true,
  "example": "bb-browser site chiphell/posts 26 1"
}
*/

async function(args) {
  const fid = args.fid || 26;
  const page = args.page || 1;
  const filter = args.filter || 'all';

  let url = `https://www.chiphell.com/forum-${fid}-${page}.html`;
  if (filter === 'heat') {
    url = `https://www.chiphell.com/forum.php?mod=forumdisplay&fid=${fid}&filter=heat&orderby=heats&page=${page}`;
  } else if (filter === 'hot') {
    url = `https://www.chiphell.com/forum.php?mod=forumdisplay&fid=${fid}&filter=hot&page=${page}`;
  } else if (filter === 'digest') {
    url = `https://www.chiphell.com/forum.php?mod=forumdisplay&fid=${fid}&filter=digest&digest=1&page=${page}`;
  }

  const resp = await fetch(url, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Login required or page not found'};

  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Detect login wall
  const msgEl = doc.querySelector('#messagetext');
  if (msgEl && msgEl.textContent.includes('尚未登录')) {
    return {error: 'Not logged in', hint: 'Please log in to Chiphell first'};
  }

  // Find thread list - try multiple selectors
  const table = doc.querySelector('#threadlisttableid') || doc.querySelector('#threadlist') || doc.querySelector('.bm');
  if (!table) {
    return {error: 'Thread list not found', hint: 'Check forum ID or login status'};
  }

  // Find all thread rows - tbody elements with normalthread id
  const tbodies = table.querySelectorAll('tbody[id^="normalthread_"]');
  
  const items = [];
  
  // Process each thread tbody
  tbodies.forEach((tbody, i) => {
    // Find title link
    const titleEl = tbody.querySelector('a.s.xst') || tbody.querySelector('a.xst') || tbody.querySelector('th a[href*="thread-"]') || tbody.querySelector('a[id^="thread_"]');
    
    if (!titleEl) return;
    
    const href = titleEl.getAttribute('href') || '';
    const tidMatch = href.match(/thread-(\d+)/);
    const tid = tidMatch ? tidMatch[1] : '';
    
    // Title text
    const titleText = titleEl.textContent.trim();
    
    // Build URL
    let fullUrl = href;
    if (href && !href.startsWith('http')) {
      fullUrl = 'https://www.chiphell.com/' + href;
    }
    
    items.push({
      rank: (page - 1) * 20 + i + 1,
      title: titleText,
      url: fullUrl
    });
  });

  // Get pagination info
  const pageInfo = doc.querySelector('.pg');
  let totalPages = 1;
  if (pageInfo) {
    const labelSpan = pageInfo.querySelector('span[title]');
    if (labelSpan) {
      const pageMatch = labelSpan.getAttribute('title').match(/共(\d+)页/);
      if (pageMatch) totalPages = parseInt(pageMatch[1]);
    }
    const lastLink = pageInfo.querySelector('a.last');
    if (lastLink) {
      const lastPage = parseInt(lastLink.textContent.trim());
      if (lastPage > totalPages) totalPages = lastPage;
    }
  }

  return {
    forumId: fid,
    page,
    totalPages,
    filter,
    count: items.length,
    items
  };
}

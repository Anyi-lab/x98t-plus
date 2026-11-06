import fs from 'fs';
import { JSDOM } from 'jsdom';

const GUIDE = 'scripts/fixtures/guide-list.html';
const THREAD = 'scripts/fixtures/thread-page.html';
if (!fs.existsSync(GUIDE) || !fs.existsSync(THREAD)) {
  console.log('SKIP: 缺少 scripts/fixtures/ 下的真实页面样本，跳过预览 DOM 测试');
  process.exit(0);
}
const guideHtml = fs.readFileSync(GUIDE, 'utf8');
const vtRaw = fs.readFileSync(THREAD);       // GBK 真页
const vtHtml = new TextDecoder('gbk').decode(vtRaw);
const SAFE_PAGE = `<html><head><title>不详</title></head><body>\n<script>var safeid='TESTSAFE123';</script></body></html>`;

const dom = new JSDOM(guideHtml, { url:'https://www.sehuatang.org/forum.php?mod=guide' });
const { document, window } = dom.window;

let cookieSet = null;
Object.defineProperty(document, 'cookie', {
  get: () => cookieSet || '',
  set: v => { cookieSet = v; },
});

let calls = 0;
window.fetch = async (href) => {
  calls++;
  // 第一次返回安全确认页，第二次（写完 cookie）返回真页
  const body = calls === 1 ? SAFE_PAGE : vtHtml;
  return { ok: true, text: async () => body };
};

// —— 被测函数：从 userscript 里原样取出 fetchPageHTML + fetchThreadPageHTML ——
const src = fs.readFileSync('x98t-plus.user.js','utf8');
const fnSrc = src.slice(src.indexOf('    async function fetchPageHTML'),
                        src.indexOf('    // 清掉「读了但没图」的空行'));
const { fetchThreadPageHTML, fetchPageHTML } = new Function(
  'document', 'fetch', 'AbortSignal',
  `${fnSrc}\nreturn { fetchThreadPageHTML, fetchPageHTML };`
)(document, (...args) => window.fetch(...args), AbortSignal);

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

calls = 0; cookieSet = null;
const html = await fetchThreadPageHTML('https://www.sehuatang.org/forum.php?mod=viewthread&tid=3850390');
check(calls === 2, `安全确认页被识别并重取（fetch 调用 ${calls} 次，应为 2）`);
check(!html.includes('var safeid='), '最终拿到的是正文而不是确认页');
check(/class="t_f"/.test(html), '正文里存在 .t_f');
check(/_safe=TESTSAFE123/.test(cookieSet || ''), '按站点自己的方式写入了 _safe cookie');

// 正常页面不能触发重取：多抓一次就是白吃一次请求预算（站点有限流）
calls = 0;
window.fetch = async () => { calls++; return { ok: true, text: async () => vtHtml }; };
const plain = await fetchPageHTML('https://www.sehuatang.org/forum.php?mod=guide', {});
check(calls === 1, `普通页面只抓 1 次，不重复请求（实际 ${calls} 次）`);
check(plain === vtHtml, '普通页面原样返回');

// 非 2xx 必须抛错，交给调用处走「加载失败，点击重试」分支
calls = 0;
let threw = false;
window.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
try { await fetchPageHTML('https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95', {}); }
catch (e) { threw = /503/.test(String(e)); }
check(threw, 'HTTP 503 抛出错误（错误信息带状态码）');
window.fetch = async (href) => {
  calls++;
  const body = calls === 1 ? SAFE_PAGE : vtHtml;
  return { ok: true, text: async () => body };
};

// —— 图片提取（照抄脚本里的条件）——
const doc2 = new JSDOM(html).window.document;
const post = doc2.querySelector('.t_f, [id^="postmessage_"], .pcb, .message');
check(!!post, '在正文里定位到 .t_f / postmessage / .pcb 之一');
const imgs = [];
post.querySelectorAll('img').forEach(el => {
  const u = el.getAttribute('file') || el.getAttribute('zoomfile') || el.getAttribute('src') || '';
  if (u && !u.includes('static') && !u.includes('avatar') && !u.includes('smiley') && /.(jpe?g|png|gif|webp)/i.test(u)) {
    if (!imgs.includes(u)) imgs.push(u);
  }
});
check(imgs.length >= 2, `从正文提取到图片 ${imgs.length} 张（应 ≥ 2）`);

// —— 挂载：用真实导读列表行验证 <tr><td colspan> 承载 ——
const gdom = new JSDOM(guideHtml, { url: 'https://www.sehuatang.org/forum.php?mod=guide' });
const gdoc = gdom.window.document;
const links = new Map();
gdoc.querySelectorAll('a[href*="thread-"], a[href*="tid="], a[href*="viewthread"]').forEach(a => {
  const tid = (a.href.match(/tid=(\d+)/) || a.href.match(/thread-(\d+)/) || [])[1];
  if (!tid || links.has(tid)) return;
  const text = (a.textContent || '').trim();
  if (!text || text.length < 3) return;
  if (!a.classList.contains('xst')) {
    const row = a.closest("tbody[id^='normalthread_'], tbody[id^='stickthread_'], tr, li");
    if (row && row.querySelector('a.xst')) return;
  }
  links.set(tid, a);
});
check(links.size === 3, `导读行扫到 ${links.size} 个主题（应为 3）`);
check(Array.from(links.values()).every(a => a.classList.contains('xst')), '命中的都是标题链接 a.xst');

let mounted = 0, invalid = 0;
for (const [tid, el] of links) {
  const hostRow = el.closest('tbody[id^="normalthread_"], tbody[id^="stickthread_"]');
  if (!hostRow) continue;
  const tr = gdoc.createElement('tr');
  tr.className = 'bgsh-preview-row';
  const td = gdoc.createElement('td');
  td.colSpan = 6;
  const host = gdoc.createElement('div');
  host.className = 'bgsh-preview-host';
  const box = gdoc.createElement('div');
  box.className = 'bgsh-pt';
  host.appendChild(box); td.appendChild(host); tr.appendChild(td);
  hostRow.appendChild(tr);
  mounted++;
}
gdoc.querySelectorAll('tbody[id^="normalthread_"]').forEach(tb => {
  Array.from(tb.children).forEach(ch => { if (ch.tagName !== 'TR') invalid++; });
});
check(mounted === 3, `挂载预览行 ${mounted} 条（应为 3）`);
check(invalid === 0, `tbody 内非法子元素 ${invalid} 个（应为 0）`);

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

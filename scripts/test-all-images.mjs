// 帖子页「一键打开全部图片」的 DOM 级验证。
// 用真实帖子页样本跑脚本，检查：
//   1) 工具栏出现「🖼️ 全部图片 (N)」按钮，N 与正文图片数一致
//   2) 点击后浮层列出全部图片，每张带序号，序号连续
//   3) 复制全部链接拿到的条数与 N 一致，且都是 http(s) 图片地址
//   4) 没有把表情/头像/占位图收进来
//   5) 按 Esc 关闭浮层
import fs from 'fs';
import { JSDOM } from 'jsdom';

const FIX = 'scripts/fixtures/thread-page.html';
if (!fs.existsSync(FIX)) {
  console.log('SKIP: 缺少 scripts/fixtures/thread-page.html');
  process.exit(0);
}
const html = new TextDecoder('gbk').decode(fs.readFileSync(FIX));
const URL0 = 'https://www.sehuatang.org/forum.php?mod=viewthread&tid=3850390';

const dom = new JSDOM(html, { url: URL0, runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const errors = [];
const store = {};
const GM = {
  GM_getValue: (k, d) => (k in store ? store[k] : d),
  GM_setValue: (k, v) => { store[k] = v; },
  GM_deleteValue: k => { delete store[k]; },
  GM_listValues: () => Object.keys(store),
  GM_registerMenuCommand: () => {},
  GM_addValueChangeListener: () => 0,
  GM_removeValueChangeListener: () => {},
  GM_openInTab: () => null,
  GM_xmlhttpRequest: () => {},
  GM_info: { script: { version: 'test', name: 'X大哥' } },
  GM_addStyle: css => { const s = window.document.createElement('style'); s.textContent = css; window.document.head.appendChild(s); return s; },
};
Object.assign(window, GM);
window.GM = { info: { script: { version: 'test', name: 'X大哥' } } };
window.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body></body></html>' });
window.confirm = () => false;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
let clipboard = '';
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: async t => { clipboard = t; } }, configurable: true,
});
window.addEventListener('error', e => errors.push('error: ' + (e.message || e.error)));
try { window.eval(fs.readFileSync('x98t-plus.user.js', 'utf8')); }
catch (e) { errors.push('顶层异常: ' + (e && e.message)); }
await new Promise(r => setTimeout(r, 2500));

const doc = window.document;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const btn = doc.getElementById('bgshOpenAllImagesButton');
check(!!btn, '工具栏出现「全部图片」按钮');
check(/全部图片/.test(btn ? btn.textContent : ''), '按钮文案正确：' + (btn ? btn.textContent : '(无)'));

// 正文里真正的图片（按脚本同一套判定：file/zoomfile 属性指向图床）
const raw = [...doc.querySelectorAll('.t_f img, [id^=postmessage_] img')]
  .map(i => i.getAttribute('file') || i.getAttribute('zoomfile') || '')
  .filter(u => /^https?:/.test(u));
const uniq = [...new Set(raw)];
check(uniq.length > 0, '样本正文含图片 ' + uniq.length + ' 张');
check(/\((\d+)\)/.test(btn ? btn.textContent : '') &&
      Number((btn.textContent.match(/\((\d+)\)/) || [])[1]) === uniq.length,
  '按钮上的张数与正文图片数一致（' + (btn ? btn.textContent : '') + '）');

btn.click();
await new Promise(r => setTimeout(r, 400));

const overlay = doc.querySelector('.bgsh-allimg-overlay');
check(!!overlay, '点击后浮层出现');
const cells = overlay ? [...overlay.querySelectorAll('a[href]')] : [];
const hrefs = cells.map(a => a.getAttribute('href'));
check(cells.length === uniq.length, '浮层列出全部 ' + cells.length + ' 张（应为 ' + uniq.length + '）');
check(hrefs.every(h => /^https?:\/\//.test(h)), '每张都是可点的 http(s) 链接');
check(!hrefs.some(h => /none\.gif|smiley|avatar|static\/image/i.test(h)), '没有混入占位图/表情/头像');
const badges = cells.map(a => (a.querySelector('span') || {}).textContent);
check(badges.join(',') === cells.map((_, i) => i + 1).join(','), '序号连续：' + badges.join(','));

// 复制全部链接
const copyBtn = overlay && overlay.querySelector('#bgshAllImgCopy');
check(!!copyBtn, '浮层里有「复制全部链接」');
if (copyBtn) {
  copyBtn.click();
  await new Promise(r => setTimeout(r, 300));
  const lines = clipboard.split('\n').filter(Boolean);
  check(lines.length === uniq.length, '复制到 ' + lines.length + ' 条链接（应为 ' + uniq.length + '）');
  check(lines.every(l => /^https?:\/\//.test(l)), '复制的内容都是 http(s) 地址');
}

// Esc 关闭
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check(!doc.querySelector('.bgsh-allimg-overlay'), '按 Esc 能关闭浮层');
check(errors.length === 0, '无运行时异常' + (errors.length ? '：' + errors[0] : ''));

// ===== 大规模场景：正文 20 张图（截图里的 1..20）=====
{
  const many = Array.from({ length: 20 }, (_, i) =>
    `<img class="zoom" src="static/image/common/none.gif" file="https://tu.djhdhs.us/tupian/forum/202611/20/p${i + 1}.jpg">`
  ).join('');
  const page = `<!doctype html><html><head><title>【26.11.20女优动态】久远美绪宣布停更</title></head><body>
<div id="postlist"><div id="post_1"><div class="t_f" id="postmessage_1">${many}</div></div></div>
</body></html>`;
  const d2 = new JSDOM(page, { url: URL0, runScripts: 'outside-only', pretendToBeVisual: true });
  const w2 = d2.window;
  Object.assign(w2, GM);
  w2.GM = { info: { script: { version: 'test', name: 'X大哥' } } };
  w2.fetch = async () => ({ ok: true, status: 200, text: async () => '<html><body></body></html>' });
  w2.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const errs2 = [];
  w2.addEventListener('error', e => errs2.push(String(e.message || e.error)));
  try { w2.eval(fs.readFileSync('x98t-plus.user.js', 'utf8')); } catch (e) { errs2.push('顶层: ' + e.message); }
  await new Promise(r => setTimeout(r, 2500));

  const b2 = w2.document.getElementById('bgshOpenAllImagesButton');
  check(!!b2, '20 图场景：按钮存在');
  check(b2 && /\(20\)/.test(b2.textContent), '20 图场景：按钮显示 (20) —— ' + (b2 ? b2.textContent : ''));
  if (b2) {
    b2.click();
    await new Promise(r => setTimeout(r, 400));
    const ov2 = w2.document.querySelector('.bgsh-allimg-overlay');
    const cs2 = ov2 ? [...ov2.querySelectorAll('a[href]')] : [];
    check(cs2.length === 20, '20 图场景：浮层列出 20 张（实际 ' + cs2.length + '）');
    const bd2 = cs2.map(a => (a.querySelector('span') || {}).textContent);
    check(bd2[0] === '1' && bd2[19] === '20' && new Set(bd2).size === 20, '20 图场景：序号 1..20 无重复');
    const lazy = cs2.map(a => a.querySelector('img')).every(i => i && i.getAttribute('loading') === 'lazy');
    check(lazy, '20 图场景：缩略图用 loading=lazy，不会一次打爆图床');
    check(!cs2.some(a => /none\.gif/i.test(a.getAttribute('href'))), '20 图场景：没把 none.gif 占位图当成图片');
    check(errs2.length === 0, '20 图场景：无运行时异常' + (errs2.length ? '：' + errs2[0] : ''));
  }
}

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

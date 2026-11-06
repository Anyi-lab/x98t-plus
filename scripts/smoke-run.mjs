// 在 jsdom 里把整份脚本真跑一遍，抓运行时异常。
// 只提供 GM_* 与 fetch 的桩，其余全部用真实的 DOM。
import fs from 'fs';
import { JSDOM } from 'jsdom';

const page = process.argv[2] || 'scripts/fixtures/forumdisplay-95.html';
const url = process.argv[3] || 'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95';
const enc = process.argv[4] || 'gbk';

const html = enc === 'gbk'
  ? new TextDecoder('gbk').decode(fs.readFileSync(page))
  : fs.readFileSync(page, 'utf8');

const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

const store = {};
// 允许通过环境变量把设置项打开（默认 displayThreadImages=false，预览根本不会跑）
if (process.env.SMOKE_SETTINGS) {
  Object.assign(store, JSON.parse(process.env.SMOKE_SETTINGS));
}
// 让预览 fetch 返回一份真实帖子页，验证「取图 → 挂行」整条链路
const threadHtmlFile = process.env.SMOKE_THREAD;
const threadHtml = process.env.SMOKE_THREAD
  ? new TextDecoder('gbk').decode(fs.readFileSync(process.env.SMOKE_THREAD))
  : '<html><body></body></html>';
const errors = [];
window.addEventListener('error', e => errors.push('error事件: ' + (e.message || e.error)));

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

  GM_info: { script: { version: '4.15.0', name: 'X大哥' } },
  GM_addStyle: css => { const s = window.document.createElement('style'); s.textContent = css; window.document.head.appendChild(s); return s; },
};
Object.assign(window, GM);
window.GM = { info: { script: { version: '4.15.0', name: 'X大哥' } } };
let fetchCount = 0;
window.fetch = async (u) => {
  fetchCount++;
  // 翻页请求（带 page=）返回 SMOKE_NEXT，方便验证「无限滚动插入新行」这条链路
  if (process.env.SMOKE_NEXT && /[?&]page=\d+/.test(String(u))) {
    return { text: async () => new TextDecoder('gbk').decode(fs.readFileSync(process.env.SMOKE_NEXT)), ok: true, status: 200 };
  }
  return { text: async () => threadHtml, ok: true, status: 200 };
};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
window.onerror = (msg) => { errors.push('onerror: ' + msg); };

const code = fs.readFileSync('x98t-plus.user.js', 'utf8');
try {
  window.eval(code);
} catch (e) {
  errors.push('顶层异常: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : e));
}

await new Promise(r => setTimeout(r, 1500));

const doc = window.document;
const report = {
  url,
  筛选栏: !!doc.getElementById('bgsh-type-filter'),
  分类按钮: doc.querySelectorAll('.bgsh-type-pill').length,
  预览块: doc.querySelectorAll('.bgsh-pt').length,
  工具栏按钮: ['bgshMergeDownloadButton','bgshExportLinksButton','bgshCopyThreadTitleButton'].filter(id => !!doc.getElementById(id)).length,
  按钮清单: ['bgshMergeDownloadButton','bgshExportLinksButton','bgshCopyThreadTitleButton'].filter(id => !!doc.getElementById(id)),
  预览行: doc.querySelectorAll('.bgsh-preview-row').length,
  fetch次数: fetchCount,
  异常: errors,
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);

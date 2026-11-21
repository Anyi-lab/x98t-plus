// 首页热门轮播「一键全部打开」的 DOM 级验证。
// 用真实首页样本跑脚本，检查：
//   1) 轮播上出现工具栏，按钮张数 = 轮播幻灯片数
//   2) 复制出来的条目数一致，且每条都是绝对 thread 地址
//   3) 标题能取到（来自 a[title] 或 .title 文本），不出现纯数字/空标题
//   4) 点击「全部打开」会调 window.open N 次（用桩计数）
//   5) 页面其它位置不会误插这个工具栏
import fs from 'fs';
import { JSDOM } from 'jsdom';

const FIX = 'scripts/fixtures/index.html';
if (!fs.existsSync(FIX)) {
  console.log('SKIP: 缺少 scripts/fixtures/index.html');
  process.exit(0);
}
const html = new TextDecoder('gbk').decode(fs.readFileSync(FIX));
const URL0 = 'https://www.sehuatang.org/';

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
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.confirm = () => false;
const opened = [];
window.open = u => { opened.push(u); return { focus() {} }; };
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

const slides = [...doc.querySelectorAll('.slidebox .slideshow li > a[href]')];
check(slides.length > 0, '样本轮播含 ' + slides.length + ' 张幻灯片');

const bar = doc.getElementById('bgshHotOpenAll');
check(!!bar, '轮播上出现工具栏');
const openBtn = doc.getElementById('bgshHotOpenAllBtn');
check(!!openBtn, '有「全部打开」按钮');
check(openBtn && openBtn.textContent.includes('(' + slides.length + ')'),
  '按钮张数 = 幻灯片数（' + (openBtn ? openBtn.textContent : '') + '）');
// 关键回归：工具栏不能压在图/页码上 —— 改成轮播后面的独立一行
const sb = doc.querySelector('.slidebox');
check(!!sb, '样本里有 .slidebox');
check(bar && bar.parentElement !== sb, '工具栏不再是 .slidebox 的子元素（不会压住封面和 1..20 页码）');
check(bar && sb && bar.previousElementSibling === sb, '工具栏紧跟在轮播后面（同一父节点）');
const bstyle = bar ? bar.style : {};
check(bstyle.position !== 'absolute', '工具栏不是绝对定位（不会浮在图上层）');

// 只插一份
check(doc.querySelectorAll('#bgshHotOpenAll').length === 1, '工具栏只插了一份');

// 复制
const copyBtn = doc.getElementById('bgshHotCopyAllBtn');
check(!!copyBtn, '有「复制」按钮');
if (copyBtn) {
  copyBtn.click();
  await new Promise(r => setTimeout(r, 300));
  const lines = clipboard.split('\n').filter(l => /^https?:\/\//.test(l));
  check(lines.length === slides.length, '复制到 ' + lines.length + ' 条链接（应为 ' + slides.length + '）');
  check(lines.every(l => /\/thread-\d+|tid=\d+/.test(l)), '复制内容都是主题地址');
  check(!/undefined|null/.test(clipboard), '复制内容没有 undefined/null 残渣');
  const titled = clipboard.split('\n').filter(l => /^\d+\. .+/.test(l));
  check(titled.length === slides.length, '每条都带序号和标题（' + titled.length + '/' + slides.length + '）');
}

// 全部打开
opened.length = 0;
if (openBtn) {
  openBtn.click();
  await new Promise(r => setTimeout(r, 300));
  check(opened.length === slides.length, '点击后 window.open 调用 ' + opened.length + ' 次（应为 ' + slides.length + '）');
  check(new Set(opened).size === opened.length, '打开的地址没有重复');
  check(opened.every(u => /^https:\/\/www\.sehuatang\.org\//.test(u)), '打开的地址都是绝对地址');
}

// 不该误伤：其它页面位置没有这个工具栏
check(doc.querySelectorAll('#bgshHotOpenAll').length === 1, '没有在别处重复插入');
check(errors.length === 0, '无运行时异常' + (errors.length ? '：' + errors[0] : ''));

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

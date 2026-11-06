import fs from 'fs';
import { JSDOM } from 'jsdom';

const CASES = [
  { file: 'scripts/fixtures/forumdisplay.html',     enc: 'gbk',   fid: '166', label: '真实版块页(fid=166)' },
  { file: 'scripts/fixtures/forumdisplay-dup.html', enc: 'utf8',  fid: '88',  label: '包含计数 span 的版块页(截图场景)' },
];

const src = fs.readFileSync('x98t-plus.user.js', 'utf8');
const start = src.indexOf('        var typeMap = {};');
const end = src.indexOf('        var typeNames = Object.keys(typeMap);');
if (start < 0 || end < 0) { console.log('FAIL 源码里找不到分类收集段'); process.exit(1); }
const body = src.slice(start, end);

// 整个 initTopicTypeFilter 函数体，用来验证「筛选栏到底有没有渲染出来」。
// 4.14.2 修好去重后，旧守卫 if (nativeItems >= typeMap.size) return; 变成永真，
// 整条栏直接不渲染 —— 单测分类名是抓不到的，必须验实测 DOM。
const fnStart = src.indexOf('    function initTopicTypeFilter');
const fnBody = (() => {
  let d = 0, j = fnStart;
  while (j < src.length) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) break; }
    j++;
  }
  return src.slice(fnStart, j + 1);
})();

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

for (const c of CASES) {
  if (!fs.existsSync(c.file)) { console.log('SKIP: 缺少 ' + c.file); continue; }
  const raw = fs.readFileSync(c.file);
  const html = c.enc === 'gbk' ? new TextDecoder('gbk').decode(raw) : raw.toString('utf8');
  const { document } = new JSDOM(html, {
    url: 'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=' + c.fid,
  }).window;

  const { typeMap } = new Function('document', 'fid', body + '\nreturn { typeMap: typeMap };')(document, c.fid);
  const names = Object.keys(typeMap);
  console.log(`\n[${c.label}] 收集 ${names.length} 个: ${names.join(' / ')}`);

  check(names.length > 0, '收集到了分类');
  check(names.every(n => !/^[\d\s]+$/.test(n)), '没有纯数字名字（截图里那个 "2"）');
  check(names.every(n => !/\d{2,}$/.test(n)), '名字尾部没有粘连帖子数');

  const ids = names.map(n => typeMap[n].typeid).filter(Boolean);
  check(new Set(ids).size === ids.length, `typeid 无重复（${ids.length} id / ${new Set(ids).size} 唯一）`);

  const prefixDup = names.filter(a => names.some(b => b !== a && b.startsWith(a)));
  check(prefixDup.length === 0, `没有前缀重复项（${prefixDup.length ? prefixDup.join(',') : '无'}）`);

  // —— 渲染验证：原生分类栏存在时，插件筛选栏仍然必须渲染 ——
  const store = {};
  const stubs = {
    GM_getValue: (k, d) => (k in store ? store[k] : d),
    GM_setValue: (k, v) => { store[k] = v; },
    getTypeFilterCollapsed: () => false,
    setTypeFilterCollapsed: () => {},
    showToast: () => {},
  };
  const dom2 = new JSDOM(html, { url: 'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=' + c.fid });
  const runFn = new Function(...Object.keys(stubs), 'window', 'document',
    fnBody + '\nreturn initTopicTypeFilter;')(...Object.values(stubs), dom2.window, dom2.window.document);
  try { runFn(); } catch (e) { console.log('  调用异常: ' + e.message); }
  const bar = dom2.window.document.getElementById('bgsh-type-filter');
  const pills = bar ? bar.querySelectorAll('.bgsh-type-pill') : [];
  check(!!bar, '筛选栏已渲染（原生分类栏存在时也要渲染）');
  check(pills.length >= names.length, `筛选栏按钮 ${pills.length} 个，覆盖 ${names.length} 个分类`);
}

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

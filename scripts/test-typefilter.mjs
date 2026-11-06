import fs from 'fs';
import { JSDOM } from 'jsdom';
import { extractFns } from './extract-fns.mjs';

const CASES = [
  { file: 'scripts/fixtures/forumdisplay.html',     enc: 'gbk',  fid: '166', label: '真实版块页(fid=166)' },
  { file: 'scripts/fixtures/forumdisplay-dup.html', enc: 'utf8', fid: '88',  label: '含计数 span 的版块页(截图场景)' },
];

const src = fs.readFileSync('x98t-plus.user.js', 'utf8');
const body = (() => {
  const start = src.indexOf('        var typeMap = {};');
  // 结尾标记只取到 `Object.keys(typeMap)`，后面可能接 .filter(...) 之类，
  // 写死整行会在改代码后直接找不到切片而误报失败。
  const end = src.indexOf('        var typeNames = Object.keys(typeMap)');
  if (start < 0 || end < 0) { console.log('FAIL 源码里找不到分类收集段'); process.exit(1); }
  return src.slice(start, end);
})();

// stripTypeParams / buildTypeHref / initTopicTypeFilter 三个函数一起抽出来跑
const fnBody = extractFns(src, ['stripTypeParams', 'buildTypeHref', 'initTopicTypeFilter']);

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

function runFilter(html, fid, url) {
  const dom = new JSDOM(html, { url });
  const store = {};
  const stubs = {
    GM_getValue: (k, d) => (k in store ? store[k] : d),
    GM_setValue: (k, v) => { store[k] = v; },
    getTypeFilterCollapsed: () => false,
    setTypeFilterCollapsed: () => {},
    showToast: () => {},
  };
  const fn = new Function(...Object.keys(stubs), 'window', 'document',
    fnBody + '\nreturn initTopicTypeFilter;')(...Object.values(stubs), dom.window, dom.window.document);
  try { fn(); } catch (e) { console.log('  调用异常: ' + e.message); }
  const bar = dom.window.document.getElementById('bgsh-type-filter');
  const pills = bar ? [...bar.querySelectorAll('.bgsh-type-pill')] : [];
  return { bar, pills, names: [...new Set(pills.map(p => p.textContent))].filter(t => t !== '🌐 全部') };
}

// ============ 1. 分类名收集 ============
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

  // ============ 2. 筛选栏必须渲染 ============
  const { bar, pills } = runFilter(html, c.fid, 'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=' + c.fid);
  check(!!bar, '筛选栏已渲染（原生分类栏存在时也要渲染）');
  check(pills.length >= names.length, `筛选栏按钮 ${pills.length} 个，覆盖 ${names.length} 个分类`);
}

// ============ 3. 分类链接构造 ============
// 旧写法对整串 URL 做正则删除，两种地址会拼出坏链接：
//   filter=typeid  ->  fid=95typeid   → Discuz 报「指定的版块不存在」（用户截图）
//   typeid=（空）   ->  残留 &typeid=  → 再拼一次就成了两个 typeid
const HREF_FIXTURE = 'scripts/fixtures/forumdisplay-95.html';
if (!fs.existsSync(HREF_FIXTURE)) {
  console.log('\nSKIP: 缺少 ' + HREF_FIXTURE + '，跳过链接构造测试');
} else {
  const hHtml = new TextDecoder('gbk').decode(fs.readFileSync(HREF_FIXTURE));
  const HREF_PAGES = [
    'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95',
    'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95&orderby=dateline&ascdesc=desc',
    'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95&typeid=&orderby=dateline&ascdesc=desc&filter=typeid&typeid=710',
    'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=710&orderby=dateline&ascdesc=desc',
  ];
  for (const pageUrl of HREF_PAGES) {
    const { pills } = runFilter(hHtml, '95', pageUrl);
    const tag = pageUrl.replace('https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95', 'fid=95') || 'fid=95';
    const broken = [], lostSort = [], wrongFid = [];
    for (const pill of pills) {
      const abs = new URL(pill.getAttribute('href') || '', pageUrl);
      const qp = Object.fromEntries(abs.searchParams);
      if (!/^\d+$/.test(qp.fid || '')) wrongFid.push(`${pill.textContent}->fid=${qp.fid}`);
      if ((abs.search.match(/typeid=/g) || []).length > 1) broken.push(`${pill.textContent}->两个 typeid`);
      if (/[?&]typeid=(&|$)/.test(abs.search)) broken.push(`${pill.textContent}->空 typeid`);
      if (pageUrl.includes('orderby=dateline') && pill.textContent !== '🌐 全部' && qp.orderby !== 'dateline') {
        lostSort.push(pill.textContent);
      }
    }
    console.log(`\n[${tag}] ${pills.length} 个按钮`);
    check(wrongFid.length === 0, `fid 参数合法${wrongFid.length ? '：' + wrongFid.slice(0, 2).join(' | ') : ''}`);
    check(broken.length === 0, `typeid 参数唯一且非空${broken.length ? '：' + broken.slice(0, 2).join(' | ') : ''}`);
    check(lostSort.length === 0, `保留当前排序${lostSort.length ? '：' + lostSort.slice(0, 3).join(',') : ''}`);
  }

  // 路径式分页：forum-95-2.html 的页码写在路径里，删 query 的 page 删不掉它。
  // 原生分类链接一律是第 1 页，点分类不该被带到不存在的第 2 页。
  const pathPageUrl = 'https://www.sehuatang.org/forum-95-2.html?filter=typeid&typeid=710&orderby=dateline&ascdesc=desc';
  const pathRun = runFilter(hHtml, '95', pathPageUrl);
  const stillPage2 = pathRun.pills
    .map(p => new URL(p.getAttribute('href') || '', pathPageUrl))
    .filter(u => /-\d+-/.test(u.pathname) && !/-1\.html$/.test(u.pathname))
    .map(u => u.pathname);
  console.log(`\n[路径分页 ${pathRun.pills.length} 个按钮]`);
  check(stillPage2.length === 0, `切分类回到第 1 页${stillPage2.length ? '：' + stillPage2.slice(0, 3).join(',') : ''}`);
  // 路径式地址里 fid 在路径上（forum-95-1.html），不在 query 里，两种形态都算合法。
  const badFid = pathRun.pills.filter(p => {
    const u = new URL(p.getAttribute('href') || '', pathPageUrl);
    const q = u.searchParams.get('fid');
    const pathFid = (u.pathname.match(/\/forum-(\d+)-\d+\.html$/) || [])[1];
    return !(/^\d+$/.test(q || '') || /^\d+$/.test(pathFid || ''));
  }).map(p => p.textContent);
  check(badFid.length === 0, `路径分页下 fid 依然合法${badFid.length ? '：' + badFid.slice(0, 3).join(',') : ''}`);
}

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

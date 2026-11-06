import fs from 'fs';
import { JSDOM } from 'jsdom';
import { extractFns } from './extract-fns.mjs';

const src = fs.readFileSync('x98t-plus.user.js', 'utf8');
const fnBody = extractFns(src, ['stripTypeParams', 'buildTypeHref', 'initTopicTypeFilter']);

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

// extractFns 找不到 typeNameFromAnchor（它是嵌套函数），先确认
console.log('typeNameFromAnchor 提取到:', /function typeNameFromAnchor/.test(fnBody));

function run(html, url) {
  const dom = new JSDOM(html, { url });
  const store = {};
  const stubs = {
    GM_getValue: (k, d) => (k in store ? store[k] : d),
    GM_setValue: (k, v) => { store[k] = v; },
    getTypeFilterCollapsed: () => false,
    setTypeFilterCollapsed: () => {},
    showToast: (m, t) => { store.__toast = m; },
  };
  const fn = new Function(...Object.keys(stubs), 'window', 'document',
    fnBody + '\nreturn { initTopicTypeFilter, stripTypeParams, buildTypeHref };')(...Object.values(stubs), dom.window, dom.window.document);
  try { fn.initTopicTypeFilter(); } catch (e) { store.__err = e.message; }
  return { dom, store, fn };
}

const shell = (inner, nav) => `<!DOCTYPE html><html><body>
<div id="wp"><div class="bm"><div id="threadlist">
<table id="threadlisttableid"><tbody id="threadlistbody">${inner}</tbody></table>
${nav || ''}
</div></div></div></body></html>`;

const row = (tid, typeid, name) => `<tbody id="normalthread_${tid}"><tr><th class="common"><a class="xst" href="thread-${tid}-1-1.html">标题${tid}</a><em><a href="forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=${typeid}">[${name}]</a></em></th><td class="by"><cite><a href="home.php?mod=space&uid=1">u</a></cite></td><td class="num">3</td></tr></tbody>`;

// 边界1：只有 1 个 typeid=0 —— 不应渲染
{
  const r = run(shell(row(1, 0, '无分类'), '<ul id="thread_types" class="ttp"><li><a href="forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=0">全部</a></li></ul>'),
                'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95');
  const bar = r.dom.window.document.getElementById('bgsh-type-filter');
  ok(!bar, '只有 typeid=0 时不渲染空筛选栏（toast: ' + (r.store.__toast || '-') + '）');
  ok(!r.store.__err, '无异常: ' + (r.store.__err || ''));
}

// 边界2：typeid 出现在 select 里（没有 #thread_types）
{
  const r = run(shell(row(2, 717, '新分类'), '<select name="typeid"><option value="0">全部</option><option value="717">新分类</option></select>'),
                'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95');
  const bar = r.dom.window.document.getElementById('bgsh-type-filter');
  const names = bar ? [...bar.querySelectorAll('.bgsh-type-pill')].map(p => p.textContent) : [];
  ok(names.includes('新分类'), 'select 里的分类能入库: ' + JSON.stringify(names));
}

// 边界3：当前 URL 是 typeid=717（select 场景），active 高亮
{
  const r = run(shell(row(3, 717, '新分类'), '<select name="typeid"><option value="717">新分类</option></select>'),
                'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=717');
  const bar = r.dom.window.document.getElementById('bgsh-type-filter');
  const act = bar ? [...bar.querySelectorAll('.bgsh-type-pill.active')].map(p => p.textContent) : [];
  ok(act.length === 1 && act[0] === '新分类', '当前分类高亮: ' + JSON.stringify(act));
}

// 边界4：分类名里带 & 和引号
{
  const r = run(shell(row(4, 900, 'A&B "X"'), '<ul id="thread_types" class="ttp"><li><a href="forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=900">A&amp;B "X"<span class="xg1 num">12</span></a></li></ul>'),
                'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95');
  const bar = r.dom.window.document.getElementById('bgsh-type-filter');
  const p = bar ? [...bar.querySelectorAll('.bgsh-type-pill')].find(x => x.getAttribute('href').includes('typeid=900')) : null;
  ok(!!p && p.textContent === 'A&B "X"', '特殊字符分类名不破坏 HTML: ' + (p ? p.textContent : 'null'));
}

// 边界5：&amp; 形式的 href 是否被正确解析（原生栏用 &amp;）
{
  const r = run(shell(row(5, 701, '甲'), '<ul id="thread_types" class="ttp"><li><a href="forum.php?mod=forumdisplay&amp;fid=95&amp;filter=typeid&amp;typeid=701">甲<span class="xg1 num">5</span></a></li></ul>'),
                'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95');
  const bar = r.dom.window.document.getElementById('bgsh-type-filter');
  const p = bar ? [...bar.querySelectorAll('.bgsh-type-pill')].find(x => x.textContent === '甲') : null;
  ok(!!p && /typeid=701/.test(p.getAttribute('href')), '&amp; 转义的 href 能解析出 typeid: ' + (p ? p.getAttribute('href') : 'null'));
}

// 边界6：stripTypeParams 对相对地址、无查询串、hash
{
  const r = run(shell('', ''), 'https://www.sehuatang.org/forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=710&page=3#abc');
  const s = r.fn.stripTypeParams('forum.php?mod=forumdisplay&fid=95&filter=typeid&typeid=710&page=3');
  ok(!/typeid|filter|page=/.test(new URL(s).search), '相对地址清参干净: ' + s);
  const s2 = r.fn.stripTypeParams('/forum-95-1.html');
  ok(s2 === 'https://www.sehuatang.org/forum-95-1.html', '无参地址不变: ' + s2);
  const b = r.fn.buildTypeHref(710);
  ok(/typeid=710/.test(b) && (new URL(b).search.match(/typeid=/g) || []).length === 1, 'buildTypeHref 只出一个 typeid');
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);

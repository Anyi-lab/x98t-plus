// 收藏夹目录（分类）持久化回归测试。
// 背景：用户反馈「分类建好会消失」。用 jsdom 真跑脚本，验证
//   1) 新建目录 → 重新加载页面后仍在
//   2) 目录列表被写坏成只剩 "/" 时，条目里用到的目录会被补回来（不会把条目降级）
//   3) 目录列表整片丢失时能从自愈备份还原
//   4) 别的页面（含他人 space-uid 链接）不会把 uid 命名空间带偏
import fs from 'fs';
import { JSDOM } from 'jsdom';

const CODE = fs.readFileSync('x98t-plus.user.js', 'utf8');
const FAV_URL = 'https://www.sehuatang.org/home.php?mod=space&do=favorite&view=me&type=thread';
const UID = '12345';
const FOLDERS_KEY = 'bgsh_folders_' + UID;
const FAVS_KEY = 'bgsh_favs_' + UID;
const BACKUP_KEY = 'bgsh_favs_backup_' + UID;

const pageWithSelf = `<!doctype html><html><head><title>我的收藏</title></head><body>
<div id="um"><a href="home.php?mod=space&uid=${UID}">测试用户</a></div>
<div id="ct"><div class="mn"><div class="bm"><div class="bm_c"></div></div></div></div>
</body></html>`;

// 没有顶栏用户信息、只有「别人」的 space-uid 链接：最低可信度的页面
const pageWithStranger = `<!doctype html><html><head><title>帖子</title></head><body>
<div class="t_f">正文 <a href="home.php?mod=space&uid=777">别人</a></div>
<div id="ct"><div class="mn"></div></div>
</body></html>`;

const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

async function boot({ page = pageWithSelf, url = FAV_URL, store }) {
  const dom = new JSDOM(page, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const errors = [];
  const GM = {
    GM_getValue: (k, d) => (k in store ? clone(store[k]) : d),
    GM_setValue: (k, v) => { store[k] = clone(v); },
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
  window.addEventListener('error', e => errors.push('error: ' + (e.message || e.error)));
  try { window.eval(CODE); } catch (e) { errors.push('顶层异常: ' + (e && e.message)); }
  await new Promise(r => setTimeout(r, 1000));
  const doc = window.document;
  const tree = () => [...doc.querySelectorAll('#bgshFavoriteTree > div')]
    .map(d => (d.querySelector('span') || d).textContent.replace(/\s+/g, ' ').trim().replace(/\s*\(\d+\)$/, ''));
  return { doc, window, errors, tree };
}

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

// ===== 场景 1：新建目录 -> 重新加载 =====
{
  const store = {};
  const first = await boot({ store });
  check(first.tree().includes('🏠 全部记录') && first.tree().includes('📦 未分类'), '首次进入：收藏夹应用渲染成功');
  const input = first.doc.getElementById('bgshFavoriteFolderInput');
  const button = first.doc.getElementById('bgshFavoriteAddFolder');
  check(!!input && !!button, '找到「创建目录」输入框与按钮');
  input.value = '测试分类';
  button.click();
  await new Promise(r => setTimeout(r, 200));
  check(first.tree().includes('📂 测试分类'), '点击后目录出现在树里');
  check(Array.isArray(store[FOLDERS_KEY]) && store[FOLDERS_KEY].includes('/测试分类'),
    '目录已写入 GM 存储：' + JSON.stringify(store[FOLDERS_KEY]));

  const second = await boot({ store });
  check(second.tree().includes('📂 测试分类'), '重新加载页面后目录仍在');

  // ===== 场景 2：目录列表被写坏，但条目还指着它 =====
  store[FAVS_KEY] = { 111: { tid: '9', title: '帖子A', url: '/forum.php?mod=viewthread&tid=9', folder: '/测试分类', processed: false, author: '' } };
  store[FOLDERS_KEY] = ['/'];
  const third = await boot({ store });
  check(third.tree().includes('📂 测试分类'), '目录列表被清空后，仍按条目把目录补回来');
  check(store[FAVS_KEY]['111'].folder === '/测试分类', '条目没有被降级成「未分类」');

  // ===== 场景 3：目录列表整片丢失，从备份还原 =====
  store[FOLDERS_KEY] = ['/'];
  store[FAVS_KEY] = {};
  store[BACKUP_KEY] = { folders: ['/', '/测试分类', '/另一个分类'], favs: {}, ts: Date.now() };
  const fourth = await boot({ store });
  check(fourth.tree().includes('📂 测试分类') && fourth.tree().includes('📂 另一个分类'),
    '目录列表空了但备份还在时，从备份还原');

  // ===== 场景 5：目录记在「另一个 uid」的键下（getUid 认错人留下的）=====
  const store3 = {};
  store3['bgsh_uid'] = UID;
  store3[FOLDERS_KEY] = ['/'];
  store3[FAVS_KEY] = {
    222: { tid: '8', title: '帖子B', url: '/forum.php?mod=viewthread&tid=8', folder: '/', processed: false, author: '' },
  };
  // 旧记录：当年被写成别人的 uid
  store3['bgsh_folders_99999'] = ['/', '/老分类甲', '/老分类乙'];
  store3['bgsh_favs_99999'] = {
    222: { tid: '8', title: '帖子B', url: '/forum.php?mod=viewthread&tid=8', folder: '/老分类甲', processed: false, author: '' },
    333: { tid: '7', title: '帖子C', url: '/forum.php?mod=viewthread&tid=7', folder: '/老分类乙', processed: false, author: '' },
  };
  const fifth = await boot({ store: store3 });
  check(fifth.tree().includes('📂 老分类甲') && fifth.tree().includes('📂 老分类乙'),
    '自动从别的 uid 键里找回目录：' + JSON.stringify(fifth.tree()));
  check(store3[FAVS_KEY]['222'] && store3[FAVS_KEY]['222'].folder === '/老分类甲',
    '被降级成「未分类」的条目回到了原目录');
  check(!!store3[FAVS_KEY]['333'], '缺的条目被补回来');

  // ===== 场景 4：他人 space-uid 链接不能把命名空间带偏 =====
  const store2 = { bgsh_uid: UID, [FOLDERS_KEY]: ['/', '/我的目录'] };
  const stranger = await boot({ page: pageWithStranger, url: 'https://www.sehuatang.org/forum.php?mod=viewthread&tid=1', store: store2 });
  check(store2.bgsh_uid === UID, '缓存 uid 没被页面上别人的 space-uid 覆盖（' + store2.bgsh_uid + '）');
  check(!Object.keys(store2).some(k => k.includes('777')), '没有为别人的 uid 建出存储键');
  check(stranger.errors.length === 0, '无运行时异常');
}

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

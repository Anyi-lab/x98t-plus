import fs from 'fs';

const src = fs.readFileSync('x98t-plus.user.js', 'utf8');

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

// —— 文件头匹配范围 ——
const header = src.slice(src.indexOf('// ==UserScript=='), src.indexOf('// ==/UserScript=='));
check(!/^\/\/ @match\s+\*:\/\/\*\/\*\s*$/m.test(header), '文件头不再有 @match *://*/*');
const matches = [...header.matchAll(/^\/\/ @match\s+(\S+)/gm)].map(m => m[1]);
check(matches.length >= 2, `@match 条数 ${matches.length}（应 ≥ 2）`);
check(matches.every(m => /(sehuatang|98tang)/.test(m)), '@match 全部限定在站点域名');
const include = [...header.matchAll(/^\/\/ @include\s+(.+)$/gm)].map(m => m[1]);
check(include.length >= 1, '@include 家族正则存在');

// —— 运行时守卫 ——
const re = (src.match(/const SITE_HOST_RE = \/(.+)\/([a-z]*);/) || []);
check(re.length > 0, '找到 SITE_HOST_RE');
const SITE_HOST_RE = new RegExp(re[1], re[2]);
const isSiteHost = h => { h = String(h || '').toLowerCase(); return !!h && SITE_HOST_RE.test(h); };

const cases = [
  ['www.sehuatang.org', true], ['www.sehuatang.net', true], ['sehuatang.org', true],
  ['www.sehuatang.me', true], ['www.98tang.net', true], ['a.b.sehuatang.org', true],
  ['www.sehuatang.org.evil.com', false], ['evil-sehuatang.org', false],
  ['sehuatang.org.cn.attacker.net', false],
  ['www.baidu.com', false], ['github.com', false], ['example.com', false],
  ['', false], ['localhost', false], ['127.0.0.1', false],
];
for (const [host, exp] of cases) {
  check(isSiteHost(host) === exp, `isSiteHost("${host}") === ${exp}`);
}

// —— @include 正则的实际覆盖能力 ——
const inc = include[0].slice(1, -1);
const INC = new RegExp(inc);
check(INC.test('https://www.sehuatang.org/forum.php?mod=guide'), '@include 匹配站点首页地址');
check(!INC.test('https://www.baidu.com/'), '@include 不匹配无关站点');

// —— main() 里必须先做域名守卫 ——
const mainIdx = src.indexOf('async function main()');
const guardIdx = src.indexOf('if (!isSiteHost()) return;');
check(guardIdx > mainIdx && guardIdx - mainIdx < 400, 'main() 开头即做域名守卫');

console.log(fails ? `\nRESULT: ${fails} failed` : '\nRESULT: all passed');
process.exit(fails ? 1 : 0);

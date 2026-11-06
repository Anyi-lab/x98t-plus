// 从 x98t-plus.user.js 里按函数名整段抽出源码，供 jsdom 测试直接执行。
// 用花括号配平来切，不靠行号，源码行数变化不会把测试弄坏。
export function extractFn(src, fnName) {
  const start = src.indexOf('    function ' + fnName + '(');
  if (start < 0) throw new Error('找不到函数 ' + fnName);
  let d = 0, j = src.indexOf('{', start);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) break; }
  }
  return src.slice(start, j + 1);
}

// 一次抽出多个函数（顺序按源码里出现的先后）
export function extractFns(src, fnNames) {
  const idx = fnNames.map(n => src.indexOf('    function ' + n + '('));
  idx.forEach((i, k) => { if (i < 0) throw new Error('找不到函数 ' + fnNames[k]); });
  const first = Math.min(...idx);
  const lastFn = fnNames[idx.indexOf(Math.max(...idx))];
  const last = src.indexOf('    function ' + lastFn + '(');
  let d = 0, j = src.indexOf('{', last);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) break; }
  }
  return src.slice(first, j + 1);
}

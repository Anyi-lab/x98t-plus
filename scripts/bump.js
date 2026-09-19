#!/usr/bin/env node
/**
 * 版本号递增：改 @version 与代码里的 scriptVer，并重新生成 meta.js
 * 用法：node scripts/bump.js <patch|minor|major|具体版本号>
 *   例：node scripts/bump.js patch   → 4.11.2 → 4.11.3
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "x98t-plus.user.js");
let code = fs.readFileSync(SCRIPT, "utf8");

const cur = (code.match(/^\/\/\s*@version\s+(\S+)/m) || [])[1];
if (!cur) { console.error("读不到 @version"); process.exit(1); }

const arg = process.argv[2] || "patch";
let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  const p = cur.split(".").map(Number);
  if (arg === "patch") p[2] += 1;
  else if (arg === "minor") { p[1] += 1; p[2] = 0; }
  else if (arg === "major") { p[0] += 1; p[1] = 0; p[2] = 0; }
  else { console.error("参数应为 patch|minor|major|x.y.z"); process.exit(1); }
  next = p.join(".");
}

code = code.replace(/^(\/\/\s*@version\s+)\S+/m, "$1" + next);
code = code.replace(/const scriptVer = "v[^"]+";/, 'const scriptVer = "v' + next + '";');
fs.writeFileSync(SCRIPT, code);
execFileSync(process.execPath, [path.join(__dirname, "gen-meta.js")], { stdio: "inherit" });
console.log(`版本号：${cur} → ${next}`);

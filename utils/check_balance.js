const fs = require("fs");
const path = "public/js/script.js";
const s = fs.readFileSync(path, "utf8");
let p = 0,
  b = 0,
  sq = 0,
  dq = 0;
const lines = s.split("\n");
const stack = [];
for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  for (let j = 0; j < L.length; j++) {
    const ch = L[j];
    if (ch === "(") p++;
    if (ch === ")") p--;
    if (ch === "{") {
      b++;
      stack.push({ line: i + 1, col: j + 1 });
    }
    if (ch === "}") {
      b--;
      if (stack.length) stack.pop();
    }
    if (ch === '"') dq = 1 - dq;
    if (ch === "'") sq = 1 - sq;
    if (p < 0 || b < 0) {
      console.log(
        "Mismatch at line",
        i + 1,
        "col",
        j + 1,
        "char",
        ch,
        "p=",
        p,
        "b=",
        b
      );
      console.log(
        "Context:\n" +
          lines
            .slice(Math.max(0, i - 3), i + 2)
            .map((x, idx) => `${i - 2 + idx}: ${x}`)
            .join("\n")
      );
      process.exit(0);
    }
  }
}
console.log("Final counts: p=", p, "b=", b);
if (stack.length) {
  console.log("Unclosed { count:", stack.length);
  console.log("Last unclosed positions (up to 5):");
  stack
    .slice(-5)
    .forEach((s) =>
      console.log(
        "  line",
        s.line,
        "col",
        s.col,
        "->",
        lines[s.line - 1].trim()
      )
    );
}

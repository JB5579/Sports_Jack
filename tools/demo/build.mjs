// Inlines the demo's data into one self-contained page:
//   node tools/demo/build.mjs  ->  exports/SportsJack-Demo.html
import { readFileSync, writeFileSync } from "node:fs";
const data = readFileSync("demo/data.json", "utf8").replace(/</g, "\\u003c");
const page = readFileSync("demo/app.html", "utf8").replace("__GAME_DATA__", () => data);
writeFileSync("exports/SportsJack-Demo.html", page);
console.log(`exports/SportsJack-Demo.html (${(page.length / 1024).toFixed(0)} KB)`);

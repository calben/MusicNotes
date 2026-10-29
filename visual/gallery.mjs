import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import config from "../playwright.config.js";

const root = path.resolve(process.env.VISUAL_OUTPUT || "screenshots/review");
const escape = (text) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[char]));
const sections = [];
let images = 0;
const audits = [];
const projects = new Set(config.projects.map(({ name }) => name));
for (const project of await readdir(root, { withFileTypes: true })) {
  if (!project.isDirectory() || !projects.has(project.name)) continue;
  for (const scenario of await readdir(path.join(root, project.name), { withFileTypes: true })) {
    if (!scenario.isDirectory()) continue;
    const folder = path.join(project.name, scenario.name);
    const files = (await readdir(path.join(root, folder))).filter((file) => file.endsWith(".png")).sort();
    images += files.length;
    for (const file of (await readdir(path.join(root, folder))).filter((file) => file.endsWith(".json"))) {
      audits.push({ project: project.name, scenario: scenario.name,
        ...JSON.parse(await readFile(path.join(root, folder, file), "utf8")) });
    }
    const sheets = [];
    for (let offset = 0; offset < files.length; offset += 20) {
      const group = files.slice(offset, offset + 20);
      const tiles = [];
      for (let index = 0; index < group.length; index++) {
        const x = (index % 4) * 360;
        const y = Math.floor(index / 4) * 300;
        const label = group[index].replace(/\.png$/, "").slice(0, 48);
        tiles.push({ input: await sharp(path.join(root, folder, group[index]))
          .resize(344, 260, { fit: "contain", background: "#f0f0f0" }).png().toBuffer(),
          left: x + 8, top: y + 32 });
        tiles.push({ input: Buffer.from(`<svg width="350" height="28"><text x="8" y="20" font-family="sans-serif" font-size="12" fill="#111">${escape(label)}</text></svg>`), left: x, top: y });
      }
      const sheet = `${project.name}-${scenario.name}-${offset / 20 + 1}.jpg`;
      await sharp({ create: { width: 1440, height: Math.ceil(group.length / 4) * 300,
        channels: 3, background: "white" } }).composite(tiles).jpeg({ quality: 88 }).toFile(path.join(root, sheet));
      sheets.push(sheet);
    }
    sections.push(`<section><h2>${escape(project.name)} / ${escape(scenario.name)}</h2>
      <p>${sheets.map((sheet, i) => `<a href="${sheet}">Contact sheet ${i + 1}</a>`).join(" · ")}</p>
      <div class="grid">${files.map((file) => `<figure><a href="${folder}/${file}"><img loading="lazy" src="${folder}/${file}" alt="${escape(file)}"></a><figcaption>${escape(file)}</figcaption></figure>`).join("")}</div></section>`);
  }
}
await writeFile(path.join(root, "audit.json"), JSON.stringify(audits, null, 2));
const failures = audits.filter((audit) => audit.violations.length);
const manualChecks = audits.filter((audit) => audit.manualChecks?.length);
await writeFile(path.join(root, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Music Notes visual review</title><style>body{font:16px system-ui;margin:24px;color:#111;background:#fafafa}h1,h2{margin-block:24px 12px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}figure{margin:0;padding:12px;background:white;border:1px solid #ccc}img{width:100%;height:260px;object-fit:contain}figcaption{overflow-wrap:anywhere;margin-top:10px}a{color:#214a9b}</style><h1>Music Notes visual review</h1><p>${images} screenshots · ${audits.length} audited views · ${failures.length} views with accessibility violations</p><p>${manualChecks.length} views also contain checks that axe could not resolve automatically (for example, gradient button backgrounds). These need visual review. Each image opens at full resolution. Adjacent JSON files contain accessibility and layout measurements. <a href="audit.json">Combined audit data</a>.</p>${sections.join("")}</html>`);
console.log(`${images} screenshots; ${audits.length} audited views; ${failures.length} views with findings. Gallery: ${path.join(root, "index.html")}`);

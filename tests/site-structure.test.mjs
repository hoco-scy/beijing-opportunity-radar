import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["index.html", "favorites.html", "monitors.html", "audit.html"];
const expectedNavigation = [
  ["index.html", "岗位"],
  ["favorites.html", "我的收藏"],
  ["monitors.html", "考试公告"],
  ["audit.html", "更新记录"],
];

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every page exposes the same four-page navigation", async () => {
  for (const page of pages) {
    const html = await read(page);
    for (const [href, label] of expectedNavigation) {
      assert.match(html, new RegExp(`<a[^>]+href="${href}"[^>]*>${label}</a>`), `${page} 缺少 ${label} 入口`);
    }
    assert.equal((html.match(/class="nav-current"/g) || []).length, 1, `${page} 应只有一个当前页标记`);
  }
});

test("favorites are available as a filter and a standalone page", async () => {
  const [index, favorites, app] = await Promise.all([read("index.html"), read("favorites.html"), read("app.js")]);
  assert.match(index, /data-saved-filter/);
  assert.match(favorites, /data-view="favorites"/);
  assert.match(app, /radar-saved-opportunities/);
  assert.match(app, /pageView === "favorites"/);
});

test("national civil service monitor uses the two current official entries", async () => {
  const [registryRaw, opportunitiesRaw] = await Promise.all([
    read("data/source-registry.json"),
    read("data/opportunities.json"),
  ]);
  const registry = JSON.parse(registryRaw);
  const opportunities = JSON.parse(opportunitiesRaw);
  const source = registry.sources.find((item) => item.id === "national-civil");
  const monitor = opportunities.monitors.find((item) => item.id === "national-civil-2027");
  const main = "http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/home/gkhome.html";
  const supplementary = "http://subb.scs.gov.cn/pp/gkweb/core/web/ui/business/home/lxhome.html";

  assert.equal(source.entryUrl, main);
  assert.deepEqual(source.alternateEntryUrls, [supplementary]);
  assert.equal(source.transportSecurity, "official-http-only");
  assert.equal(monitor.officialUrl, main);
  assert.equal(monitor.alternateOfficialUrl, supplementary);
});

test("removed template-like slogans do not return", async () => {
  const content = (await Promise.all([...pages, "app.js", "audit.js"].map(read))).join("\n");
  for (const phrase of ["某单位在招", "线索可以很杂", "公开数据必须很干净"]) {
    assert.doesNotMatch(content, new RegExp(phrase));
  }
});

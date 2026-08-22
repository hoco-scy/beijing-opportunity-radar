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

test("failed sources have explicit recovery routes and processing recipes", async () => {
  const [registryRaw, recipesRaw, planRaw] = await Promise.all([
    read("data/source-registry.json"),
    read("data/filter-recipes.json"),
    read("data/source-plan.json"),
  ]);
  const registry = JSON.parse(registryRaw);
  const recipes = JSON.parse(recipesRaw);
  const plan = JSON.parse(planRaw);
  const source = (id) => registry.sources.find((item) => item.id === id);
  const recipeIds = new Set(recipes.recipes.map((item) => item.sourceId));
  const repaired = [
    "china-public-recruitment", "central-sasac-recruitment", "sinopec-careers",
    "cmcc-careers", "chinatelecom-careers", "casic-careers",
    "spacechina-careers", "chinapost-recruitment",
  ];

  assert.equal(registry.version, 3);
  assert.equal(recipes.version, 2);
  for (const id of repaired) {
    assert.ok(source(id)?.accessMode, `${id} 缺少访问方式`);
    assert.ok(recipeIds.has(id), `${id} 缺少处理配方`);
  }
  assert.match(source("china-public-recruitment").alternateEntryUrls[0], /^http:\/\/job\.mohrss\.gov\.cn/);
  assert.match(source("central-sasac-recruitment").alternateEntryUrls[0], /^http:\/\/wap\.sasac\.gov\.cn/);
  assert.equal(source("chinatelecom-careers").entryUrl, "https://job.chinatelecom.com.cn/wt/TELE/web/index/campus");
  assert.equal(source("chinapost-recruitment").entryUrl, "https://www.chinapost.com.cn/");
  assert.deepEqual(source("casic-careers").semanticFailureSignals, ["/404?errorpath=", "Not Found"]);
  assert.equal(plan.sourceOutcomeDefinitions["accessible-incomplete"].includes("入口可用"), true);
});

test("top bar shows only the update time while audit retains run details", async () => {
  const [opportunitiesRaw, app, audit] = await Promise.all([
    read("data/opportunities.json"), read("app.js"), read("audit.js"),
  ]);
  const opportunities = JSON.parse(opportunitiesRaw);
  assert.equal(opportunities.meta.lastIncompleteSourceCount, 9);
  assert.equal(opportunities.meta.lastDeferredCandidateCount, 1935);
  assert.match(app, /最近更新：/);
  assert.match(audit, /最近更新：/);
  assert.match(audit, /个来源未完成/);
  assert.doesNotMatch(`${app}\n${audit}`, /上次未查完|候选待处理|部分网站未完成|部分网站没查完/);
});

test("removed template-like slogans do not return", async () => {
  const content = (await Promise.all([...pages, "app.js", "audit.js"].map(read))).join("\n");
  for (const phrase of ["某单位在招", "线索可以很杂", "公开数据必须很干净"]) {
    assert.doesNotMatch(content, new RegExp(phrase));
  }
});

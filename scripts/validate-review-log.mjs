import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const opportunities = JSON.parse(await readFile(new URL("data/opportunities.json", root), "utf8"));
const log = JSON.parse(await readFile(new URL("data/review-log.json", root), "utf8"));
const registry = JSON.parse(await readFile(new URL("data/source-registry.json", root), "utf8"));
const sources = new Map(registry.sources.map((source) => [source.id, source]));
const errors = [];
const minuteTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;
const decisions = new Set(["accepted", "rejected", "deferred"]);

function officialDomain(urlValue, source) {
  try {
    const url = new URL(urlValue);
    return url.protocol === "https:" && source.domains.some((domain) =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

if (log.meta?.schemaVersion !== 1) errors.push("review-log meta.schemaVersion 必须为 1");
if (!minuteTimestamp.test(log.meta?.lastRunAt || "")) errors.push("review-log meta.lastRunAt 必须精确到北京时间分钟");
if (log.meta?.lastRunAt !== opportunities.meta?.lastVerifiedAt) errors.push("最近核验时间与审核日志最后运行时间不一致");
if (!Array.isArray(log.runs) || !log.runs.length) errors.push("review-log.runs 至少需要一轮记录");
if (log.runs?.[0]?.checkedAt !== log.meta?.lastRunAt) errors.push("最新一轮日志必须与 meta.lastRunAt 一致并排在首位");

const runIds = new Set();
const reviewIds = new Set();
for (const [runIndex, run] of (log.runs || []).entries()) {
  const label = `runs[${runIndex}]`;
  for (const key of ["id", "checkedAt", "trigger", "status", "outcome", "summary", "metrics", "sourceChecks", "reviews"]) {
    if (run[key] === undefined || run[key] === null || run[key] === "") errors.push(`${label}.${key} 缺失`);
  }
  if (runIds.has(run.id)) errors.push(`${label}.id 重复`);
  runIds.add(run.id);
  if (!minuteTimestamp.test(run.checkedAt || "")) errors.push(`${label}.checkedAt 必须精确到北京时间分钟`);

  const metrics = run.metrics || {};
  for (const key of ["officialSystemsChecked", "officialSystemsSucceeded", "officialSystemsFailed", "newLeads", "reviewedItems", "accepted", "rejected", "deferred", "published", "updated", "closed"]) {
    if (!Number.isInteger(metrics[key]) || metrics[key] < 0) errors.push(`${label}.metrics.${key} 必须是非负整数`);
  }
  if (metrics.officialSystemsSucceeded + metrics.officialSystemsFailed !== metrics.officialSystemsChecked) errors.push(`${label} 官方来源成功与失败数量不闭合`);
  if (metrics.accepted + metrics.rejected + metrics.deferred !== metrics.reviewedItems) errors.push(`${label} 审核结论数量与 reviewedItems 不闭合`);
  if ((run.reviews || []).length !== metrics.reviewedItems) errors.push(`${label}.reviews 数量与 reviewedItems 不一致`);

  for (const [sourceIndex, check] of (run.sourceChecks || []).entries()) {
    if (!sources.get(check.sourceId)?.officialSiteConfirmed) errors.push(`${label}.sourceChecks[${sourceIndex}] 未引用已登记官方来源`);
    if (!check.status || !check.note) errors.push(`${label}.sourceChecks[${sourceIndex}] 状态或说明缺失`);
  }

  for (const [reviewIndex, review] of (run.reviews || []).entries()) {
    const reviewLabel = `${label}.reviews[${reviewIndex}]`;
    for (const key of ["id", "scope", "track", "organization", "title", "officialPublishedAt", "headcount", "deadline", "decision", "reasonCode", "reason", "verificationNote", "fallback", "sourceId", "officialUrl"]) {
      if (!review[key]) errors.push(`${reviewLabel}.${key} 缺失`);
    }
    if (reviewIds.has(review.id)) errors.push(`${reviewLabel}.id 重复`);
    reviewIds.add(review.id);
    if (!decisions.has(review.decision)) errors.push(`${reviewLabel}.decision 不受支持`);
    const source = sources.get(review.sourceId);
    if (!source?.officialSiteConfirmed) errors.push(`${reviewLabel}.sourceId 未登记为官方来源`);
    else if (!officialDomain(review.officialUrl, source)) errors.push(`${reviewLabel}.officialUrl 不属于登记的官方域名`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`审核日志门禁通过：${log.runs.length} 轮运行，${reviewIds.size} 个匿名审核对象。`);

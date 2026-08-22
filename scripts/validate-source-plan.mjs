import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("data/source-registry.json", root), "utf8"));
const plan = JSON.parse(await readFile(new URL("data/source-plan.json", root), "utf8"));
const errors = [];
const sourceIds = new Set();

if (registry.version !== 2) errors.push("source-registry.version 必须为 2");
if (plan.version !== 2) errors.push("source-plan.version 必须为 2");
if (plan.timezone !== "Asia/Shanghai") errors.push("source-plan.timezone 必须为 Asia/Shanghai");

for (const [index, source] of (registry.sources || []).entries()) {
  for (const key of ["id", "organization", "type", "role", "tier", "cadence", "domains", "entryUrl"]) {
    if (!source[key] || (Array.isArray(source[key]) && !source[key].length)) errors.push(`sources[${index}].${key} 缺失`);
  }
  if (sourceIds.has(source.id)) errors.push(`来源 id 重复：${source.id}`);
  sourceIds.add(source.id);
  try {
    if (new URL(source.entryUrl).protocol !== "https:") errors.push(`来源不是 HTTPS：${source.id}`);
  } catch { errors.push(`来源 URL 无效：${source.id}`); }
  if (source.role === "authoritative" && source.officialSiteConfirmed !== true) errors.push(`权威来源未确认官方属性：${source.id}`);
  if (source.role === "discovery" && source.officialSiteConfirmed !== false) errors.push(`发现来源不得标记为官方证据：${source.id}`);
}

const retry = plan.retryPolicy || {};
if (retry.criticalMaxAttempts < 3 || retry.activeMaxAttempts < 3) errors.push("critical 与 active 来源必须至少尝试 3 次");
if (retry.failureOutcome !== "completed-partial") errors.push("来源失败的运行结果必须是 completed-partial");

const listed = [
  ...(plan.coverage?.criticalEveryRun || []),
  ...(plan.coverage?.morningRotation || []),
  ...(plan.coverage?.noonRotation || []),
];
for (const id of listed) if (!sourceIds.has(id)) errors.push(`source-plan 引用了未登记来源：${id}`);
for (const id of (plan.coverage?.criticalEveryRun || [])) {
  const source = registry.sources.find((item) => item.id === id);
  if (source?.tier !== "critical" || source?.cadence !== "every-run") errors.push(`关键来源分级或频次错误：${id}`);
}

if (!plan.announcementLifecycle?.beforeApplicationOpens?.includes("不得")) errors.push("必须明确预公告不得因尚未开放报名而排除");
if (!plan.announcementLifecycle?.withPositionTable?.includes("具体岗位")) errors.push("预公告附职位表时必须拆到具体岗位");
if (plan.qualityFilter?.unknownIsNotNegative !== true) errors.push("薪资或强度未知不得作为负面事实");
if (plan.qualityFilter?.lowRankNeverMeansExclude !== true) errors.push("低排名不得自动排除岗位");
if (!plan.positionScan?.largeDatasetStrategy?.includes("screening-policy.json") || !plan.positionScan.largeDatasetStrategy.includes("filter-recipes.json")) errors.push("大规模职位入口必须引用 screening-policy.json 与 filter-recipes.json");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`来源计划门禁通过：${registry.sources.length} 个来源，${plan.coverage.criticalEveryRun.length} 个每轮必查官方入口。`);

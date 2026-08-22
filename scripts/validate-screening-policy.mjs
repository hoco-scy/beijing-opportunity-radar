import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const policy = JSON.parse(await readFile(new URL("data/screening-policy.json", root), "utf8"));
const recipes = JSON.parse(await readFile(new URL("data/filter-recipes.json", root), "utf8"));
const errors = [];

if (policy.version !== 2) errors.push("screening-policy.version 必须为 2");
if (policy.mode !== "official-native-filter-first") errors.push("筛选模式必须是 official-native-filter-first");

for (const key of ["preferOfficialNativeFilters", "neverTraverseUnfilteredPortalWhenReliableFiltersExist", "combineQueriesByUnion", "deduplicateBeforeModelReview", "lowRankNeverMeansExclude", "unknownMeansDeferNotReject"]) {
  if (policy.principles?.[key] !== true) errors.push(`principles.${key} 必须为 true`);
}

const stageIds = new Set((policy.stages || []).map((stage) => stage.id));
for (const id of ["discover-native-capabilities", "native-filter-union", "normalize-and-deduplicate", "semantic-batch-review", "official-verification"]) {
  if (!stageIds.has(id)) errors.push(`缺少筛选阶段：${id}`);
}

if (policy.sourceCapabilityPolicy?.registry !== "data/filter-recipes.json") errors.push("必须使用 filter-recipes.json 保存站点筛选能力");
if (policy.sourceCapabilityPolicy?.stopNarrowingWhenAtOrBelow > 100) errors.push("安全筛选后不超过 100 个岗位时必须停止继续缩小");
if (policy.sourceCapabilityPolicy?.keywordFiltersOnlyWhenSafeFiltersStillExceed < 150) errors.push("结果不超过 150 个岗位时不得为节省成本强制使用关键词缩小");

const model = policy.modelPolicy || {};
if (model.routineModel !== "GPT-5.6 Terra") errors.push("常规任务模型必须是 GPT-5.6 Terra");
if (!Number.isInteger(model.batchSizeTarget) || model.batchSizeTarget < 20 || model.batchSizeTarget > 60) errors.push("模型批量复核目标必须在 20 至 60 个岗位之间");
if (model.highReasoning?.defaultEnabled !== false) errors.push("高推理不得默认参与常规扫描");
if (!Number.isInteger(model.highReasoning?.maxItemsPerRun) || model.highReasoning.maxItemsPerRun > 20) errors.push("高推理每轮最多处理 20 项");
if (model.highReasoning?.overflowOutcome !== "deferred") errors.push("高推理溢出项必须进入 deferred");

const requiredMetrics = new Set(policy.requiredRunMetrics || []);
for (const key of ["portalResultsReported", "nativeFilterQueries", "nativeFilteredResults", "deduplicatedCandidates", "positionsBatchReviewed", "positionsOfficiallyVerified", "positionsEscalated", "positionsDeferredByBudget"]) {
  if (!requiredMetrics.has(key)) errors.push(`缺少运行指标：${key}`);
}

if (recipes.version !== 1 || !Array.isArray(recipes.recipes)) errors.push("filter-recipes.json 格式无效");
const recipeIds = new Set();
for (const recipe of (recipes.recipes || [])) {
  if (!recipe.sourceId || recipeIds.has(recipe.sourceId)) errors.push(`筛选配方 sourceId 缺失或重复：${recipe.sourceId || "unknown"}`);
  recipeIds.add(recipe.sourceId);
  if (!["verified", "pending-observation"].includes(recipe.status)) errors.push(`筛选配方状态无效：${recipe.sourceId}`);
  if (recipe.status === "verified" && (!recipe.nativeFilters?.length || !recipe.queryPlan)) errors.push(`已验证筛选配方缺少控件或查询计划：${recipe.sourceId}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`站内筛选策略门禁通过：${recipes.recipes.length} 个来源已有筛选配方记录，常规批量 ${model.batchSizeTarget} 项。`);

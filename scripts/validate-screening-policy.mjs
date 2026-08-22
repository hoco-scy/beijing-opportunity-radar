import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const policy = JSON.parse(await readFile(new URL("data/screening-policy.json", root), "utf8"));
const errors = [];

if (policy.version !== 1) errors.push("screening-policy.version 必须为 1");
if (policy.mode !== "structured-batch-first") errors.push("筛选模式必须是 structured-batch-first");
if (!Number.isInteger(policy.largeDatasetThreshold) || policy.largeDatasetThreshold > 200) errors.push("大规模数据阈值不得高于 200");

for (const key of ["scanEveryOfficialRow", "neverUseOneModelCallPerRow", "neverPasteWholeTableIntoModelContext", "lowRankNeverMeansExclude", "unknownMeansDeferNotReject"]) {
  if (policy.principles?.[key] !== true) errors.push(`principles.${key} 必须为 true`);
}

const stageIds = new Set((policy.stages || []).map((stage) => stage.id));
for (const id of ["normalize", "deterministic-gates", "semantic-batch-review", "official-verification"]) {
  if (!stageIds.has(id)) errors.push(`缺少筛选阶段：${id}`);
}

const model = policy.modelPolicy || {};
if (model.routineModel !== "GPT-5.6 Terra") errors.push("常规任务模型必须是 GPT-5.6 Terra");
if (!Number.isInteger(model.batchSizeTarget) || model.batchSizeTarget < 20 || model.batchSizeTarget > 60) errors.push("模型批量复核目标必须在 20 至 60 个岗位之间");
if (model.highReasoning?.defaultEnabled !== false) errors.push("高推理不得默认参与常规扫描");
if (!Number.isInteger(model.highReasoning?.maxItemsPerRun) || model.highReasoning.maxItemsPerRun > 20) errors.push("高推理每轮最多处理 20 项");
if (model.highReasoning?.overflowOutcome !== "deferred") errors.push("高推理溢出项必须进入 deferred");

const qa = policy.qualityAssurance || {};
if (qa.sampleMachineRejections !== true || qa.sampleRate < 0.03 || qa.minimumPerReasonCode < 3) errors.push("机器排除项必须按至少 3% 且每个原因至少 3 项抽样复核");

const requiredMetrics = new Set(policy.requiredRunMetrics || []);
for (const key of ["positionsDiscovered", "positionsMachineScreened", "positionsMachineRejected", "positionsBatchReviewed", "positionsOfficiallyVerified", "positionsEscalated", "positionsDeferredByBudget"]) {
  if (!requiredMetrics.has(key)) errors.push(`缺少运行指标：${key}`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`批量筛选策略门禁通过：超过 ${policy.largeDatasetThreshold} 个岗位启用分层处理，常规批量 ${model.batchSizeTarget} 项。`);

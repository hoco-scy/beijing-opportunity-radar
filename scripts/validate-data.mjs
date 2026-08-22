import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const data = JSON.parse(await readFile(new URL("data/opportunities.json", root), "utf8"));
const registry = JSON.parse(await readFile(new URL("data/source-registry.json", root), "utf8"));
const sources = new Map(registry.sources.map((source) => [source.id, source]));
const errors = [];
const required = [
  "id", "track", "organization", "department", "title", "exactTitle", "jobCode",
  "location", "cohort", "education", "majors", "responsibilities", "requirements",
  "publishedAt", "deadline", "status", "matchLevel", "matchReason", "sourceId",
  "officialAnnouncementUrl", "officialApplyUrl", "verifiedAt", "verifiedFields", "verification"
];
const publicExamTracks = new Set(["考公", "选调优培"]);
const publicExamChecks = [
  "graduationAndDegree", "candidateCategory", "majorAndCode", "ageAndNationality",
  "householdOrStudentOrigin", "institutionAndStudyMode", "politicalStatus",
  "grassrootsExperience", "honorsAndRecommendation", "certificatesAndOtherLimits",
  "avoidanceRules", "positionNotes"
];
const minuteTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;

function officialDomain(urlValue, source) {
  try {
    const url = new URL(urlValue);
    return url.protocol === "https:" && source.domains.some((domain) =>
      url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

if (data.meta?.schemaVersion !== 1) errors.push("meta.schemaVersion 必须为 1");
if (!minuteTimestamp.test(data.meta?.lastVerifiedAt || "")) errors.push("meta.lastVerifiedAt 必须是精确到分钟的北京时间，例如 2026-08-22T08:03:00+08:00");
if (!Array.isArray(data.jobs) || !Array.isArray(data.monitors)) errors.push("jobs 和 monitors 必须是数组");

const ids = new Set();
for (const [index, job] of (data.jobs || []).entries()) {
  const label = `jobs[${index}]`;
  for (const key of required) {
    const value = job[key];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) errors.push(`${label}.${key} 缺失`);
  }
  if (ids.has(job.id)) errors.push(`${label}.id 重复: ${job.id}`);
  ids.add(job.id);

  const source = sources.get(job.sourceId);
  if (!source?.officialSiteConfirmed) errors.push(`${label}.sourceId 未登记为官方来源`);
  else {
    if (!officialDomain(job.officialAnnouncementUrl, source)) errors.push(`${label}.officialAnnouncementUrl 不属于登记的官方域名`);
    if (!officialDomain(job.officialApplyUrl, source)) errors.push(`${label}.officialApplyUrl 不属于登记的官方域名`);
  }

  for (const field of ["officialSource", "specificPosition", "location", "eligibility", "applicationPath", "deadlineChecked"]) {
    if (job.verification?.[field] !== true) errors.push(`${label}.verification.${field} 未通过`);
  }

  if (publicExamTracks.has(job.track)) {
    if (job.eligibilityDecision !== "confirmed") errors.push(`${label} 是公考/选调岗位，但 eligibilityDecision 不是 confirmed`);
    const checks = new Map((job.eligibilityChecks || []).map((check) => [check.key, check.status]));
    for (const key of publicExamChecks) {
      if (checks.get(key) !== "pass") errors.push(`${label} 公考资格检查 ${key} 未明确通过`);
    }
    if (job.riskNotes?.length) errors.push(`${label} 公考岗位仍有未决风险，不允许发布`);
  }
}

for (const [index, monitor] of (data.monitors || []).entries()) {
  for (const key of ["id", "track", "title", "status", "note", "officialUrl", "checkedAt"]) {
    if (!monitor[key]) errors.push(`monitors[${index}].${key} 缺失`);
  }
  if (!minuteTimestamp.test(monitor.checkedAt || "")) errors.push(`monitors[${index}].checkedAt 必须精确到北京时间分钟`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`数据门禁通过：${data.jobs.length} 个具体岗位，${data.monitors.length} 个公告监测项。`);

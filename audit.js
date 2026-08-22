const auditState = { decision: "all", data: null };

const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const httpOnlyOfficialHosts = new Set(["bm.scs.gov.cn", "subb.scs.gov.cn"]);
const safeUrl = (value = "") => {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.href;
    if (url.protocol === "http:" && httpOnlyOfficialHosts.has(url.hostname)) return url.href;
    return "#";
  } catch { return "#"; }
};

const formatDateTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value)).replaceAll("/", ".") : "未记录";

const decisionLabels = { accepted: "已收录", rejected: "不符合", deferred: "还要确认" };
const runStatusLabels = { completed: "本次已完成", "completed-partial": "部分网站没查完", failed: "本次没有完成" };
const scopeLabels = { announcement: "整份公告", position: "具体岗位", "official-system": "招聘官网" };
const sourceLabels = {
  "national-civil": "国家公务员局",
  "beijing-civil": "北京市公务员招考",
  "beijing-personnel-exam": "北京市人事考试平台",
  "beijing-institutions": "北京市事业单位招聘",
  "central-institutions": "中央和国家机关事业单位招聘",
  "china-public-recruitment": "中国公共招聘网",
  "central-sasac-recruitment": "国务院国资委招聘",
  "central-enterprise-roster": "中央企业名录",
  "beijing-state-assets": "北京市国资委招聘",
  "picc-campus": "中国人保校园招聘",
  "boe-campus": "京东方校园招聘",
  "cmcc-careers": "中国移动招聘",
  "chinatelecom-careers": "中国电信招聘",
  "sinopec-careers": "中国石化招聘",
  "casic-careers": "中国航天科工招聘",
  "spacechina-careers": "中国航天科技招聘",
  "chinapost-recruitment": "中国邮政招聘",
};
const sourceStatusLabels = {
  "checked-deferred": "看过了，还要继续确认",
  "checked-full-pagination": "已看完筛选结果",
  "checked-no-new-position-table": "暂无新的职位表",
  "checked-no-publishable-change": "没有需要加入的新岗位",
  "checked-roster-current": "企业名单没有变化",
  "temporarily-unavailable": "这次没能打开",
};

function filteredReviews(run) {
  if (auditState.decision === "all") return run.reviews;
  return run.reviews.filter((review) => review.decision === auditState.decision);
}

function renderReview(review) {
  return `<article class="review-card decision-${escapeHTML(review.decision)}">
    <div class="review-card-topline">
      <span class="decision-badge">${escapeHTML(decisionLabels[review.decision] || review.decision)}</span>
      <span>${escapeHTML(review.track)} · ${escapeHTML(scopeLabels[review.scope] || "招聘信息")}</span>
    </div>
    <h4>${escapeHTML(review.title)}</h4>
    <p class="review-org">${escapeHTML(review.organization)}</p>
    <div class="review-facts"><span>${escapeHTML(review.headcount)}</span><span>截止：${escapeHTML(review.deadline)}</span><span>发布：${escapeHTML(review.officialPublishedAt)}</span></div>
    <div class="review-reason"><strong>为什么</strong><p>${escapeHTML(review.reason)}</p></div>
    <p class="review-note">${escapeHTML(review.verificationNote)}</p>
    <div class="review-fallback"><strong>想自己再看看？</strong><p>${escapeHTML(review.fallback)}</p><a href="${safeUrl(review.officialUrl)}" target="_blank" rel="noreferrer">打开原始页面 ↗</a></div>
  </article>`;
}

function renderScreeningMetrics(run) {
  const metrics = run.screeningMetrics;
  if (!metrics) return "";
  const nativeFilterStrategy = Number(run.screeningStrategyVersion || 1) >= 2;
  const items = nativeFilterStrategy ? [
    ["官网显示的岗位", metrics.portalResultsReported], ["使用官网筛选", metrics.nativeFilterQueries],
    ["筛选后剩余", metrics.nativeFilteredResults], ["去重后需要看", metrics.deduplicatedCandidates],
    ["批量检查", metrics.positionsBatchReviewed], ["打开详情核对", metrics.positionsOfficiallyVerified],
    ["复杂问题", metrics.positionsEscalated], ["下次继续", metrics.positionsDeferredByBudget],
  ] : [
    ["旧方法发现", metrics.positionsDiscovered], ["旧方法自动筛选", metrics.positionsMachineScreened],
    ["批量检查", metrics.positionsBatchReviewed], ["打开详情核对", metrics.positionsOfficiallyVerified],
    ["下次继续", metrics.positionsDeferredByBudget],
  ];
  const rows = items.map(([label, value]) => `<li><strong>${escapeHTML(label)}</strong><span>${escapeHTML(value)}</span></li>`).join("");
  const title = nativeFilterStrategy ? "这次是怎么缩小范围的" : "旧方法处理了多少岗位";
  return `<details class="source-checks"><summary>${title} <span>＋</span></summary><ul>${rows}</ul></details>`;
}

function renderRun(run) {
  const reviews = filteredReviews(run);
  const metrics = run.metrics;
  const changed = metrics.published + metrics.updated + metrics.closed;
  let outcome = changed ? `岗位页有 ${changed} 项变化` : "岗位页没有变化";
  if (run.status === "completed-partial") outcome = `部分网站没查完 · ${outcome}`;
  if (run.status === "failed") outcome = "这次更新没有完成";

  const sourceChecks = run.sourceChecks.map((source) => `<li><strong>${escapeHTML(sourceLabels[source.sourceId] || source.sourceId)}</strong><span><b>${escapeHTML(sourceStatusLabels[source.status] || source.status)}</b>${source.attempts ? ` · 试了 ${source.attempts} 次` : ""}<br />${escapeHTML(source.note)}</span></li>`).join("");
  const reviewContent = reviews.length
    ? reviews.map(renderReview).join("")
    : `<div class="empty-state compact"><strong>这次没有这一类记录</strong><p>可以切换上面的筛选查看其他结果。</p></div>`;

  return `<article class="audit-run">
    <header class="run-header">
      <div><span class="run-time">${formatDateTime(run.checkedAt)}</span><h3>${escapeHTML(outcome)}</h3><p>${escapeHTML(run.summary)}</p></div>
      <span class="run-status ${escapeHTML(run.status)}">${escapeHTML(runStatusLabels[run.status] || run.status)}</span>
    </header>
    <div class="run-metrics">
      <div><strong>${metrics.officialSystemsSucceeded}/${metrics.officialSystemsChecked}</strong><span>看过的官网</span></div>
      <div><strong>${metrics.newLeads}</strong><span>新发现</span></div>
      <div><strong>${metrics.reviewedItems}</strong><span>逐条看过</span></div>
      <div><strong>${metrics.accepted}</strong><span>已收录</span></div>
      <div><strong>${metrics.rejected}</strong><span>不符合</span></div>
      <div><strong>${metrics.deferred}</strong><span>还要确认</span></div>
    </div>
    ${renderScreeningMetrics(run)}
    <details class="source-checks"><summary>这次看了哪些网站 <span>＋</span></summary><ul>${sourceChecks}</ul></details>
    <div class="review-grid">${reviewContent}</div>
  </article>`;
}

function render() {
  const latest = auditState.data.runs[0];
  const partial = latest.status === "completed-partial" ? "（部分网站未完成）" : "";
  document.querySelector("#sync-date").innerHTML = `<i></i>最近更新${partial}：${formatDateTime(auditState.data.meta.lastRunAt)}`;
  document.querySelector("#latest-run").textContent = formatDateTime(latest.checkedAt);
  document.querySelector("#latest-reviewed").textContent = `${latest.metrics.reviewedItems} 项`;
  document.querySelector("#latest-published").textContent = `${latest.metrics.published} 项`;
  document.querySelector("#audit-run-list").innerHTML = auditState.data.runs.map(renderRun).join("");
}

function bindFilters() {
  document.querySelectorAll("[data-decision]").forEach((button) => button.addEventListener("click", () => {
    auditState.decision = button.dataset.decision;
    document.querySelectorAll("[data-decision]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  }));
}

async function init() {
  try {
    const response = await fetch("data/review-log.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    auditState.data = await response.json();
    bindFilters();
    render();
  } catch (error) {
    document.querySelector("#audit-run-list").innerHTML = `<div class="empty-state"><strong>更新记录暂时没有加载出来</strong><p>请稍后刷新页面。</p></div>`;
    console.error("Failed to load review log", error);
  }
}

init();

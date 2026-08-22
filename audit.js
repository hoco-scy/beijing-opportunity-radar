const auditState = { decision: "all", data: null };

const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const safeUrl = (value = "") => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : "#"; }
  catch { return "#"; }
};

const formatDateTime = (value) => value ? new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value)).replaceAll("/", ".") : "未记录";

const labels = {
  accepted: "通过门禁",
  rejected: "未通过",
  deferred: "继续核验",
};

const runStatusLabels = {
  completed: "运行完成",
  "completed-partial": "部分完成",
  failed: "运行失败",
};

function filteredReviews(run) {
  if (auditState.decision === "all") return run.reviews;
  return run.reviews.filter((review) => review.decision === auditState.decision);
}

function renderReview(review) {
  return `<article class="review-card decision-${escapeHTML(review.decision)}">
    <div class="review-card-topline">
      <span class="decision-badge">${escapeHTML(labels[review.decision] || review.decision)}</span>
      <span>${escapeHTML(review.track)} · ${escapeHTML(review.scope === "announcement" ? "公告级" : "官方系统级")}</span>
    </div>
    <h4>${escapeHTML(review.title)}</h4>
    <p class="review-org">${escapeHTML(review.organization)}</p>
    <div class="review-facts"><span>${escapeHTML(review.headcount)}</span><span>截止：${escapeHTML(review.deadline)}</span><span>发布：${escapeHTML(review.officialPublishedAt)}</span></div>
    <div class="review-reason"><strong>审核结论</strong><p>${escapeHTML(review.reason)}</p></div>
    <p class="review-note">${escapeHTML(review.verificationNote)}</p>
    <div class="review-fallback"><strong>兜底入口</strong><p>${escapeHTML(review.fallback)}</p><a href="${safeUrl(review.officialUrl)}" target="_blank" rel="noreferrer">查看官方页面 ↗</a></div>
  </article>`;
}

function renderScreeningMetrics(run) {
  const metrics = run.screeningMetrics;
  if (!metrics) return "";
  const nativeFilterStrategy = Number(run.screeningStrategyVersion || 1) >= 2;
  const items = nativeFilterStrategy ? [
    ["入口报告总量", metrics.portalResultsReported], ["官网筛选查询", metrics.nativeFilterQueries],
    ["站内筛选结果", metrics.nativeFilteredResults], ["去重候选", metrics.deduplicatedCandidates],
    ["模型批量复核", metrics.positionsBatchReviewed], ["官方逐岗核验", metrics.positionsOfficiallyVerified],
    ["高推理疑难项", metrics.positionsEscalated], ["后续轮次继续", metrics.positionsDeferredByBudget],
  ] : [
    ["旧版入口发现", metrics.positionsDiscovered], ["旧版机器扫描", metrics.positionsMachineScreened],
    ["旧版模型复核", metrics.positionsBatchReviewed], ["官方逐岗核验", metrics.positionsOfficiallyVerified],
    ["后续轮次继续", metrics.positionsDeferredByBudget],
  ];
  const rows = items.map(([label, value]) => `<li><strong>${escapeHTML(label)}</strong><span>${escapeHTML(value)}</span></li>`).join("");
  const title = nativeFilterStrategy ? "查看官网筛选漏斗" : "查看旧版全入口漏斗";
  return `<details class="source-checks"><summary>${title} <span>＋</span></summary><ul>${rows}</ul></details>`;
}

function renderRun(run) {
  const reviews = filteredReviews(run);
  const metrics = run.metrics;
  const outcomeText = run.outcome === "no-publishable-change" ? "正文无变化" : "正文有更新";
  const outcome = `${run.status === "completed-partial" ? "部分完成" : "完成核验"} · ${outcomeText}`;
  const sourceChecks = run.sourceChecks.map((source) => `<li><strong>${escapeHTML(source.status)}${source.attempts ? ` · 尝试 ${source.attempts} 次` : ""}</strong><span>${escapeHTML(source.note)}</span></li>`).join("");
  const reviewContent = reviews.length
    ? reviews.map(renderReview).join("")
    : `<div class="empty-state compact"><strong>本轮没有这一结论的记录</strong><p>切换筛选查看其他审核结果。</p></div>`;

  return `<article class="audit-run">
    <header class="run-header">
      <div><span class="run-time">${formatDateTime(run.checkedAt)}</span><h3>${escapeHTML(outcome)}</h3><p>${escapeHTML(run.summary)}</p></div>
      <span class="run-status ${escapeHTML(run.status)}">${escapeHTML(runStatusLabels[run.status] || run.status)}</span>
    </header>
    <div class="run-metrics">
      <div><strong>${metrics.officialSystemsSucceeded}/${metrics.officialSystemsChecked}</strong><span>官方系统成功</span></div>
      <div><strong>${metrics.newLeads}</strong><span>新增线索</span></div>
      <div><strong>${metrics.reviewedItems}</strong><span>审核对象</span></div>
      <div><strong>${metrics.accepted}</strong><span>通过</span></div>
      <div><strong>${metrics.rejected}</strong><span>未通过</span></div>
      <div><strong>${metrics.deferred}</strong><span>继续核验</span></div>
    </div>
    ${renderScreeningMetrics(run)}
    <details class="source-checks"><summary>查看来源系统状态 <span>＋</span></summary><ul>${sourceChecks}</ul></details>
    <div class="review-grid">${reviewContent}</div>
  </article>`;
}

function render() {
  const latest = auditState.data.runs[0];
  const partial = latest.status === "completed-partial" ? "（部分）" : "";
  document.querySelector("#sync-date").textContent = `最近核验${partial}：${formatDateTime(auditState.data.meta.lastRunAt)}`;
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
    bindFilters(); render();
  } catch (error) {
    document.querySelector("#audit-run-list").innerHTML = `<div class="empty-state"><strong>审核日志暂时没有加载成功</strong><p>数据恢复前不会显示未经校验的替代内容。</p></div>`;
    console.error("Failed to load review log", error);
  }
}

init();

const state = { activeTrack: "全部", activeMatch: "全部", query: "", data: null };
const tasks = [
  "优先核对并投递招满即停的北京岗位",
  "对央国企“相关专业”口径向招聘单位确认",
  "准备公考职位表的专业代码与硬条件核验表",
];

const readList = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
};
let saved = readList("radar-saved-opportunities");
let doneTasks = readList("radar-done-tasks");

const escapeHTML = (value = "") => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const safeUrl = (value = "") => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : "#"; }
  catch { return "#"; }
};
const formatDate = (value) => value ? value.replaceAll("-", ".") : "未注明";

function searchText(job) {
  return [job.title, job.exactTitle, job.organization, job.department, job.location,
    job.jobCode, job.education, job.majors, job.matchReason, ...job.tags,
    ...job.responsibilities, ...job.requirements].join(" ").toLowerCase();
}

function filteredJobs() {
  const keyword = state.query.trim().toLowerCase();
  return state.data.jobs.filter((job) =>
    (state.activeTrack === "全部" || job.track === state.activeTrack) &&
    (state.activeMatch === "全部" || job.matchLevel === state.activeMatch) &&
    (!keyword || searchText(job).includes(keyword))
  );
}

function renderCards() {
  const jobs = filteredJobs();
  const list = document.querySelector("#opportunity-list");
  document.querySelector("#result-count").textContent = `${jobs.length} 个具体岗位`;

  if (!jobs.length) {
    const message = state.activeTrack === "考公"
      ? "公考只展示已经逐项确认可报的职位；尚未发布职位表或存在未确认条件时，这里会保持为空。"
      : "没有职位名称或职位代码的信息不会进入具体岗位列表。";
    list.innerHTML = `<div class="empty-state"><strong>暂时没有符合当前筛选的具体岗位</strong><p>${message}</p></div>`;
    return;
  }

  list.innerHTML = jobs.map((job) => {
    const isSaved = saved.includes(job.id);
    const verified = job.verifiedFields.map((field) => `<span>✓ ${escapeHTML(field)}</span>`).join("");
    const risks = job.riskNotes.length
      ? `<div class="risk-note"><strong>投递前确认</strong><ul>${job.riskNotes.map((note) => `<li>${escapeHTML(note)}</li>`).join("")}</ul></div>`
      : "";
    const gate = job.track === "考公" ? "资格硬条件已确认" : "官方逐岗核验";

    return `<article class="opportunity-card">
      <div class="card-accent" data-track="${escapeHTML(job.track)}"></div>
      <div class="card-content">
        <div class="card-topline">
          <span class="track-tag track-${escapeHTML(job.track)}">${escapeHTML(job.track)}</span>
          <span class="official-tag">● ${gate}</span>
          <span class="freshness-tag">${escapeHTML(job.status)}</span>
          <button class="save-button ${isSaved ? "saved" : ""}" data-save="${escapeHTML(job.id)}" type="button" aria-label="收藏 ${escapeHTML(job.title)}">${isSaved ? "♥" : "♡"}</button>
        </div>
        <div class="card-title-row">
          <div><h3>${escapeHTML(job.title)}</h3><p>${escapeHTML(job.organization)} · ${escapeHTML(job.department)}</p></div>
          <div class="match-score"><strong>${escapeHTML(job.priority)}</strong><span>${escapeHTML(job.matchLevel)}</span></div>
        </div>
        <div class="job-facts">
          <div><span>职位代码</span><strong>${escapeHTML(job.jobCode)}</strong></div>
          <div><span>工作地点</span><strong>${escapeHTML(job.location)}</strong></div>
          <div><span>招聘对象</span><strong>${escapeHTML(job.cohort)}</strong></div>
          <div><span>学历要求</span><strong>${escapeHTML(job.education)}</strong></div>
          <div><span>招聘人数</span><strong>${escapeHTML(job.headcount)}</strong></div>
          <div><span>发布时间</span><strong>${formatDate(job.publishedAt)}</strong></div>
        </div>
        <p class="match-reason"><strong>岗位判断</strong>${escapeHTML(job.matchReason)}</p>
        <div class="requirement-strip"><span>专业要求</span><p>${escapeHTML(job.majors)}</p></div>
        <div class="tag-row">${job.tags.map((tag) => `<span>${escapeHTML(tag)}</span>`).join("")}</div>
        <details class="job-details">
          <summary>查看岗位职责与完整资格条件 <span>＋</span></summary>
          <div class="details-grid">
            <section><h4>岗位职责</h4><ul>${job.responsibilities.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></section>
            <section><h4>资格条件</h4><ul>${job.requirements.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></section>
          </div>
          ${risks}
          <div class="verification-row"><strong>已核字段</strong>${verified}</div>
        </details>
        <div class="card-footer">
          <div class="deadline-block"><span>截止口径</span><strong>${escapeHTML(job.deadline)}</strong></div>
          <div class="source-actions"><a href="${safeUrl(job.officialAnnouncementUrl)}" target="_blank" rel="noreferrer">招聘说明 ↗</a><a class="apply-link" href="${safeUrl(job.officialApplyUrl)}" target="_blank" rel="noreferrer">官网搜索 ${escapeHTML(job.jobCode)} ↗</a></div>
        </div>
        <p class="source-note">${escapeHTML(job.applyInstruction)} · 核验于 ${formatDate(job.verifiedAt)}</p>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-save]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.save;
    saved = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    localStorage.setItem("radar-saved-opportunities", JSON.stringify(saved));
    updateCounts(); renderCards();
  }));
}

function renderMonitors() {
  document.querySelector("#monitor-grid").innerHTML = state.data.monitors.map((monitor) => `<article class="monitor-card">
    <div><span class="monitor-track">${escapeHTML(monitor.track)}</span><span class="monitor-status">${escapeHTML(monitor.status)}</span></div>
    <h3>${escapeHTML(monitor.title)}</h3><p>${escapeHTML(monitor.note)}</p>
    <footer><span>最近检查 ${formatDate(monitor.checkedAt)}</span><a href="${safeUrl(monitor.officialUrl)}" target="_blank" rel="noreferrer">官方入口 ↗</a></footer>
  </article>`).join("");
}

function renderTasks() {
  document.querySelector("#task-list").innerHTML = tasks.map((task, index) => `<label class="task ${doneTasks.includes(index) ? "done" : ""}"><input type="checkbox" data-task="${index}" ${doneTasks.includes(index) ? "checked" : ""}/><span class="fake-check">✓</span><span>${escapeHTML(task)}</span></label>`).join("");
  document.querySelectorAll("[data-task]").forEach((box) => box.addEventListener("change", () => {
    const index = Number(box.dataset.task);
    doneTasks = doneTasks.includes(index) ? doneTasks.filter((item) => item !== index) : [...doneTasks, index];
    localStorage.setItem("radar-done-tasks", JSON.stringify(doneTasks));
    renderTasks(); updateCounts();
  }));
}

function updateCounts() {
  document.querySelector("#saved-count").textContent = saved.length;
  document.querySelector("#task-count").textContent = `${doneTasks.length}/${tasks.length}`;
}

function updateSummary() {
  const jobs = state.data.jobs;
  document.querySelector("#sync-date").textContent = `最近核验：${formatDate(state.data.meta.lastVerifiedAt)}`;
  document.querySelector("#stat-jobs").textContent = jobs.length;
  document.querySelector("#stat-beijing").textContent = jobs.filter((job) => job.location.includes("北京")).length;
  document.querySelector("#stat-tracks").textContent = new Set(jobs.map((job) => job.track)).size;
  document.querySelector("#hero-job-count").textContent = jobs.length;
}

function bindFilters() {
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    state.activeTrack = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    renderCards();
  }));
  document.querySelectorAll("[data-match]").forEach((button) => button.addEventListener("click", () => {
    state.activeMatch = button.dataset.match;
    document.querySelectorAll("[data-match]").forEach((item) => item.classList.toggle("active", item === button));
    renderCards();
  }));
  document.querySelector("#search").addEventListener("input", (event) => { state.query = event.target.value; renderCards(); });
}

async function init() {
  try {
    const response = await fetch("data/opportunities.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    updateSummary(); bindFilters(); renderCards(); renderMonitors(); renderTasks(); updateCounts();
  } catch (error) {
    document.querySelector("#opportunity-list").innerHTML = `<div class="empty-state"><strong>岗位数据暂时没有加载成功</strong><p>数据恢复前不会展示未经核验的替代内容。</p></div>`;
    console.error("Failed to load verified opportunities", error);
  }
}
init();

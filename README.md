# 北京求职雷达

匿名公开的岗位级信息看板，重点关注京考、国考、北京定向选调与优培、北京事业单位，以及工作地点在北京的央国企岗位。

## 工作方式

- 高召回发现：覆盖生物医学工程、工学、理工类、交叉专业与不限专业，不以医学关键词提前截断结果。
- 官网筛选优先：充分利用每个招聘站自己的届别、地点、学历、类别和关键词控件，多组结果取并集后再由模型批量复核。
- 官方逐岗核验：公考遍历完整职位表；央国企遍历官方招聘系统全部分页和职位板块。
- 预公告追踪：官方已发布且截止未过即纳入；有职位表时生成“即将开放”岗位，无职位表时写入审核日志持续追踪。
- 失败可见：关键官网最多尝试三次，仍失败则显示“部分完成”，绝不把访问失败当作没有公告。
- 客观质量筛选：只有官方可核验的明显低待遇、高强度、高危、有害暴露、长期夜班倒班或重体力等事实才会硬排除；未知信息保留待确认，不使用性别刻板印象。
- 匿名门禁：公考使用私有资格档案逐项判断，但公开仓库不保存或显示任何私人值。

岗位数据位于 `data/opportunities.json`，审核记录位于 `data/review-log.json`，来源池和运行策略位于 `data/source-registry.json`、`data/source-plan.json`、`data/screening-policy.json` 与 `data/filter-recipes.json`。正文只展示通过门禁的具体岗位，`audit.html` 展示每轮匿名发现、核验、通过、未通过和继续跟踪记录。

提交前运行：

```bash
node scripts/validate-source-plan.mjs
node scripts/validate-screening-policy.mjs
node scripts/validate-data.mjs
node scripts/validate-review-log.mjs
node scripts/check-privacy.mjs
```

GitHub Pages 只有在四项门禁全部通过后才会部署。

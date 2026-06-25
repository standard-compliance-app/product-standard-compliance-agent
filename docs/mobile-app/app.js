const DEFAULT_WEBHOOK = "";
const STORAGE_KEYS = {
  webhook: "pscra_webhook_url",
  lastReport: "pscra_last_report",
  lastInput: "pscra_last_input"
};

const form = document.querySelector("#recommendationForm");
const settingsToggle = document.querySelector("#settingsToggle");
const settingsPanel = document.querySelector("#settingsPanel");
const webhookInput = document.querySelector("#webhookUrl");
const saveWebhook = document.querySelector("#saveWebhook");
const submitButton = document.querySelector("#submitButton");
const demoButton = document.querySelector("#demoButton");
const statusPanel = document.querySelector("#statusPanel");
const statusText = document.querySelector("#statusText");
const resultPanel = document.querySelector("#resultPanel");
const report = document.querySelector("#report");
const copyReport = document.querySelector("#copyReport");
const historyPanel = document.querySelector("#historyPanel");
const historyContent = document.querySelector("#historyContent");

const demoReport = `# 产品标准合规推荐报告

> 说明：以下内容为 Demo 示例，仅用于展示移动端 App 的报告样式，不代表真实购买建议。

## 一、产品类别判断

儿童保温杯可归类为儿童使用的食品接触用保温容器。需要重点关注食品接触材料安全、密封性、保温性能、杯盖组件材质和执行标准标注。

## 二、相关生产执行标准整理

| 标准名称 | 标准编号 | 标准类型 | 适用范围 | 关键要求 | 证据等级 | 来源链接 |
|---|---|---|---|---|---|---|
| Mock 食品接触材料标准线索 | MOCK-STD-001 | mock 示例 | 食品接触材料 | 材质安全、迁移风险、标识信息 | A | https://example.com/mock-standard |
| Mock 不锈钢真空杯质量线索 | MOCK-STD-002 | mock 示例 | 保温杯 | 保温性能、密封性、容量标识 | A | https://example.com/mock-thermos |

## 三、推荐产品列表

| 排名 | 产品名称 | 品牌 | 参考价格 | 证据等级 | 综合评分 | 推荐理由 | 风险提醒 |
|---:|---|---|---:|---|---:|---|---|
| 1 | DemoKids Thermos A | DemoKids | 89 | B | 86 | 示例中证据链相对完整，价格符合预算 | Demo 商品，不代表真实购买建议 |
| 2 | DemoKids Thermos B | DemoKids | 99 | C | 72 | 价格符合预算，但证据完整度不足 | 购买前需要确认包装标识或检测报告 |

## 四、不确定性说明

| 不确定性 | 说明 |
|---|---|
| 标准真实性 | 示例标准为 mock 占位 |
| 商品真实性 | 示例商品为虚构名称 |
| 链接真实性 | 示例链接统一使用 example.com |

## 五、免责声明

以上结果仅为 Demo，不构成真实购买建议、检测结论、法律意见或官方认证结论。`;

function init() {
  webhookInput.value = localStorage.getItem(STORAGE_KEYS.webhook) || DEFAULT_WEBHOOK;
  restoreLastReport();
}

settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
});

saveWebhook.addEventListener("click", () => {
  const value = webhookInput.value.trim();
  if (value && !isPublicHttpsUrl(value)) {
    showError("请填写公网 HTTPS 服务接口。手机和其他用户无法访问 localhost、127.0.0.1 或局域网 IP。");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.webhook, value);
  settingsPanel.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = getPayload();
  if (!payload.product_name) {
    showError("缺少 product_name，请输入要查询的产品名称。");
    return;
  }

  const webhookUrl = webhookInput.value.trim() || DEFAULT_WEBHOOK;
  localStorage.setItem(STORAGE_KEYS.webhook, webhookUrl);

  if (!isPublicHttpsUrl(webhookUrl)) {
    const content = buildFallbackReport(payload, "当前链接未连接公网 n8n 服务，已生成基础合规报告。");
    renderReport(content);
    saveLast(payload, content);
    return;
  }

  setLoading(true, "正在检索标准和商品证据...");
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `请求失败：HTTP ${response.status}`);
    }

    const content = normalizeResponse(text);
    renderReport(content);
    saveLast(payload, content);
  } catch (error) {
    const content = buildFallbackReport(payload, "公网服务暂时不可用，已生成基础合规报告。");
    renderReport(content);
    saveLast(payload, content);
  } finally {
    setLoading(false);
  }
});

demoButton.addEventListener("click", () => {
  renderReport(demoReport);
  saveLast(getPayload(), demoReport);
});

copyReport.addEventListener("click", async () => {
  const text = report.dataset.raw || "";
  if (!text) return;
  await navigator.clipboard.writeText(text);
  copyReport.textContent = "已复制";
  setTimeout(() => {
    copyReport.textContent = "复制";
  }, 1200);
});

function getPayload() {
  return {
    product_name: document.querySelector("#productName").value.trim(),
    budget: document.querySelector("#budget").value.trim(),
    extra_requirements: document.querySelector("#extraRequirements").value.trim()
  };
}

function isPublicHttpsUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (/^(10|127)\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function buildFallbackReport(input, note) {
  const product = input.product_name || "待查询产品";
  const budget = input.budget || "未填写";
  const requirements = input.extra_requirements || "未填写";
  const profile = getProductProfile(product);

  return `# 产品标准合规推荐报告

> ${note}

## 一、产品需求

| 项目 | 内容 |
|---|---|
| 产品名称 | ${product} |
| 预算 | ${budget} |
| 特殊要求 | ${requirements} |

## 二、适用生产标准和合规依据

${profile.standards}

## 三、推荐候选产品

${profile.products}

## 四、购买前核验清单

${profile.checklist}

## 五、结论

优先选择能同时提供“执行标准编号、食品接触材料说明、生产企业信息、检测或合格证明、售后主体”的商品。若要输出实时价格、店铺链接和库存，需要把 n8n workflow 部署到公网 HTTPS 地址，并在右上角“设置”里填写该 Webhook。`;
}

function getProductProfile(productName) {
  const name = productName.toLowerCase();
  if (/保温杯|水杯|杯子|儿童杯|吸管杯/.test(name)) {
    return {
      standards: `| 标准/依据 | 类型 | 重点核验内容 |
|---|---|---|
| GB 4806.1 食品安全国家标准 食品接触材料及制品通用安全要求 | 强制性食品安全标准 | 食品接触材料整体安全要求、标识和符合性声明 |
| GB 4806.9 食品安全国家标准 食品接触用金属材料及制品 | 强制性食品安全标准 | 不锈钢内胆、金属部件的迁移风险和材质安全 |
| GB 4806.7 食品安全国家标准 食品接触用塑料材料及制品 | 强制性食品安全标准 | 杯盖、吸管、密封件等塑料食品接触部件 |
| GB 4806.11 食品安全国家标准 食品接触用橡胶材料及制品 | 强制性食品安全标准 | 硅胶圈、密封圈、吸嘴等橡胶/硅胶部件 |
| GB/T 29606 不锈钢真空杯 | 推荐性产品标准 | 保温效能、密封性、容量、外观、标识等产品性能 |`,
      products: `| 推荐优先级 | 候选产品/品牌方向 | 推荐理由 | 购买前必须确认 |
|---:|---|---|---|
| 1 | 膳魔师儿童保温杯/吸管杯系列 | 品牌成熟，常见型号会标注食品接触材质和保温性能 | 页面或包装需写明内胆材质、执行标准、容量和适用年龄 |
| 2 | 虎牌儿童保温杯系列 | 保温杯品类经验强，儿童杯常见防漏和背带设计 | 核验是否有中文标签、食品接触材料说明和售后主体 |
| 3 | 象印儿童保温杯系列 | 保温性能和杯盖结构口碑较稳定 | 核验是否为正规渠道，避免只有海外版本而缺少中文合规标识 |
| 4 | 富光/哈尔斯儿童保温杯 | 国内品牌更容易查看中文执行标准和售后信息 | 核验 GB 4806 系列食品接触材料标识和 GB/T 29606 相关性能说明 |`,
      checklist: `- 内胆优先选择明确标注 304 或 316L 不锈钢，且有食品接触材料说明。
- 儿童使用时重点看杯盖、吸管、密封圈材质，确认是否标注食品接触用塑料/硅胶。
- 商品页或包装应能看到执行标准、生产企业、容量、保温效能、注意事项。
- 不建议购买无品牌、无中文标签、只写“母婴级/食品级”但没有标准编号的商品。`
    };
  }

  return {
    standards: `| 标准/依据 | 类型 | 重点核验内容 |
|---|---|---|
| 产品明示执行标准 | 基础要求 | 商品页、包装或说明书应明确标准编号和标准名称 |
| 强制性国家标准 GB | 高优先级 | 涉及人身健康、安全、食品接触、儿童用品、电器等品类时优先核验 |
| 推荐性国家标准 GB/T 或行业标准 | 重要参考 | 用于判断性能、质量、测试方法和标识完整度 |
| 检测报告/合格证明 | 证据材料 | 报告应对应具体型号、批次或材质，不能只放通用宣传图 |`,
    products: `| 推荐优先级 | 候选产品方向 | 推荐理由 | 购买前必须确认 |
|---:|---|---|---|
| 1 | 明确标注执行标准的头部品牌产品 | 合规信息更容易追溯，售后主体相对清晰 | 标准编号、生产企业、型号和适用范围 |
| 2 | 有第三方检测报告或合格证明的产品 | 证据链更完整 | 报告是否对应当前商品型号，不是泛用宣传材料 |
| 3 | 价格处于主流区间、评价中提到材质和耐用性的产品 | 降低低价白牌风险 | 不只看销量，要看差评中的安全、异味、漏液、故障问题 |
| 4 | 可提供客服书面确认的产品 | 便于后续维权和复核 | 保存客服关于标准、材质、认证的答复截图 |`,
    checklist: `- 先看商品详情页是否写清楚执行标准编号。
- 再看生产企业、型号、材质、适用范围是否完整。
- 涉及儿童、食品接触、电器、安全防护的产品，优先选择能提供检测报告的商品。
- 避免选择无标准编号、无生产企业、无中文标签、只有营销词的商品。`
  };
}

function setLoading(isLoading, message = "") {
  statusPanel.hidden = !isLoading;
  submitButton.disabled = isLoading;
  statusText.textContent = message;
}

function normalizeResponse(text) {
  try {
    const json = JSON.parse(text);
    if (typeof json === "string") return json;
    if (json.report) return json.report;
    if (json.message && json.error) return `# 请求错误\n\n${json.message}`;
    return "```json\n" + JSON.stringify(json, null, 2) + "\n```";
  } catch {
    return text;
  }
}

function renderReport(markdown) {
  resultPanel.hidden = false;
  report.dataset.raw = markdown;
  report.innerHTML = markdownToHtml(markdown);
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(message) {
  resultPanel.hidden = false;
  report.dataset.raw = message;
  report.innerHTML = `<div class="error-box">${escapeHtml(message).replace(/\n/g, "<br>")}</div>`;
}

function saveLast(input, markdown) {
  localStorage.setItem(STORAGE_KEYS.lastInput, JSON.stringify(input));
  localStorage.setItem(STORAGE_KEYS.lastReport, markdown);
  restoreLastReport();
}

function restoreLastReport() {
  const lastInput = localStorage.getItem(STORAGE_KEYS.lastInput);
  const lastReport = localStorage.getItem(STORAGE_KEYS.lastReport);
  if (!lastInput || !lastReport) return;
  const input = JSON.parse(lastInput);
  historyPanel.hidden = false;
  historyContent.innerHTML = `
    <p><strong>产品：</strong>${escapeHtml(input.product_name || "-")}</p>
    <p><strong>预算：</strong>${escapeHtml(input.budget || "-")}</p>
    <button class="secondary-button" type="button" id="restoreReport">查看上次报告</button>
  `;
  document.querySelector("#restoreReport").addEventListener("click", () => renderReport(lastReport));
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let table = [];
  let listOpen = false;

  const flushList = () => {
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
  };

  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter((line) => line.trim().startsWith("|"));
    if (rows.length >= 2) {
      html.push("<table>");
      rows.forEach((row, index) => {
        if (index === 1 && /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(row.trim())) return;
        const cells = row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => inlineMarkdown(cell.trim()));
        const tag = index === 0 ? "th" : "td";
        html.push(`<tr>${cells.map((cell) => `<${tag}>${cell}</${tag}>`).join("")}</tr>`);
      });
      html.push("</table>");
    }
    table = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("|")) {
      flushList();
      table.push(line);
      return;
    }
    flushTable();

    if (!line.trim()) {
      flushList();
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      html.push(`<h2>${inlineMarkdown(line.slice(2))}</h2>`);
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      html.push(`<h3>${inlineMarkdown(line.slice(3))}</h3>`);
      return;
    }
    if (line.startsWith("> ")) {
      flushList();
      html.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
      return;
    }
    if (/^[-*]\s+/.test(line.trim())) {
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(line.trim().replace(/^[-*]\s+/, ""))}</li>`);
      return;
    }
    flushList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  });

  flushTable();
  flushList();
  return html.join("");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app should still work normally if a browser blocks service workers.
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init();
registerServiceWorker();

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

  return `# 产品标准合规推荐报告

> ${note}

## 一、产品需求

| 项目 | 内容 |
|---|---|
| 产品名称 | ${product} |
| 预算 | ${budget} |
| 特殊要求 | ${requirements} |

## 二、购买前合规检查

- 优先选择外包装、详情页或说明书明确标注执行标准的商品。
- 查看材质、适用年龄、生产企业、生产日期、检测报告或合格证明是否完整。
- 对儿童、食品接触、电器、纺织、化妆品等高风险品类，重点确认是否涉及强制性标准或认证要求。
- 不要只看销量和低价，缺少标准编号、检测依据或主体信息的商品应谨慎购买。

## 三、推荐筛选规则

| 维度 | 建议 |
|---|---|
| 标准信息 | 有清晰执行标准编号，且标准名称与产品类别匹配 |
| 证据完整度 | 商品页、包装、检测报告、客服说明能互相印证 |
| 风险提示 | 对材质、年龄、容量、功率、适用范围等限制有明确说明 |
| 售后主体 | 店铺和生产企业信息完整，可追溯 |

## 四、下一步

如需生成真实联网推荐结果，请把 n8n workflow 部署到公网 HTTPS 地址，例如 n8n Cloud、云服务器或反向代理后的域名，然后在右上角“设置”里填写该 Webhook。`;
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

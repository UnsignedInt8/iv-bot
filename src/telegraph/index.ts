import { htmlToTelegraphNodes } from "./dom";

const MAX_CONTENT_BYTES = 65_000;
const TELEGRAPH_API = "https://api.telegra.ph/createPage";

// 从环境变量加载 Telegraph token（支持多个轮换）
function getToken(): string {
  const tokens: string[] = [];
  for (let i = 0; i <= 9; i++) {
    const t = process.env[`TGPHTOKEN_${i}`];
    if (t) tokens.push(t);
  }
  if (tokens.length === 0) throw new Error("No TGPHTOKEN configured");
  // 按小时轮换
  const hour = new Date().getHours();
  return tokens[hour % tokens.length];
}

function byteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

async function createPage(
  title: string,
  authorUrl: string,
  content: unknown[],
  token: string
): Promise<string> {
  const body = {
    access_token: token,
    title: title.slice(0, 256),
    author_url: authorUrl.slice(0, 512),
    content,
    return_content: false,
  };
  const res = await fetch(TELEGRAPH_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegraph API error: ${res.statusText}`);
  const json = (await res.json()) as { ok: boolean; result?: { url: string }; error?: string };
  if (!json.ok) throw new Error(`Telegraph error: ${json.error}`);
  return json.result!.url;
}

// 多页：内容超过 65KB 时拆分
async function createMultiPage(
  title: string,
  authorUrl: string,
  nodes: unknown[],
  token: string
): Promise<string> {
  const totalBytes = byteLength(JSON.stringify(nodes));
  const chunkCount = Math.ceil(totalBytes / MAX_CONTENT_BYTES) + 1;
  const chunkSize = Math.ceil(nodes.length / chunkCount);

  const chunks: unknown[][] = [];
  for (let i = 0; i < nodes.length; i += chunkSize) {
    chunks.push(nodes.slice(i, i + chunkSize));
  }

  let nextLink = "";
  // 从最后一页往前建
  for (let i = chunks.length - 1; i >= 0; i--) {
    let chunk = [...chunks[i]];
    if (nextLink) {
      chunk.push({
        tag: "p",
        children: [{ tag: "a", attrs: { href: nextLink }, children: ["→ Next page"] }],
      });
    }
    await new Promise((r) => setTimeout(r, 3_000)); // 避免 Telegraph rate limit
    const pageTitle = chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title;
    nextLink = await createPage(pageTitle, authorUrl, chunk, token);
  }
  return nextLink;
}

export interface TelegraphResult {
  url: string;
  isMultiPage: boolean;
  pageCount: number;
}

export async function uploadToTelegraph(
  title: string,
  sourceUrl: string,
  html: string
): Promise<TelegraphResult> {
  const token = getToken();
  const nodes = htmlToTelegraphNodes(html);
  const content = JSON.stringify(nodes);
  const bytes = byteLength(content);

  if (bytes <= MAX_CONTENT_BYTES) {
    const url = await createPage(title, sourceUrl, nodes, token);
    return { url, isMultiPage: false, pageCount: 1 };
  }

  const pageCount = Math.ceil(bytes / MAX_CONTENT_BYTES) + 1;
  const url = await createMultiPage(title, sourceUrl, nodes, token);
  return { url, isMultiPage: true, pageCount };
}

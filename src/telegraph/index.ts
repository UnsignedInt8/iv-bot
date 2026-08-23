import {
  htmlToTelegraphNodes,
  type TelegraphNode,
  type TelegraphNodeOrText,
} from "./dom";

// Telegraph rejects content at roughly 64 KiB. Keep the existing conservative
// limit and reserve room for the pagination link added to non-final pages.
export const MAX_CONTENT_BYTES = 65_000;
const PAGINATION_LINK_RESERVE_BYTES = 2_048;
const MAX_PAGE_CONTENT_BYTES = MAX_CONTENT_BYTES - PAGINATION_LINK_RESERVE_BYTES;
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

export function telegraphContentBytes(content: unknown[]): number {
  return byteLength(JSON.stringify(content));
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

function splitText(text: string, maxBytes: number): string[] {
  if (byteLength(JSON.stringify(text)) <= maxBytes) return [text];

  const chars = Array.from(text);
  const chunks: string[] = [];
  let start = 0;

  while (start < chars.length) {
    let low = start + 1;
    let high = chars.length;
    let end = start;

    // Find the longest UTF-8-safe substring that fits the node budget.
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = chars.slice(start, middle).join("");
      if (byteLength(JSON.stringify(candidate)) <= maxBytes) {
        end = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    if (end === start) {
      throw new Error("Telegraph content contains a text node that cannot be paginated");
    }
    chunks.push(chars.slice(start, end).join(""));
    start = end;
  }

  return chunks;
}

function splitNode(node: TelegraphNodeOrText, maxBytes: number): TelegraphNodeOrText[] {
  if (node === false) return [];
  if (typeof node === "string") return splitText(node, maxBytes);
  if (byteLength(JSON.stringify(node)) <= maxBytes) return [node];

  const children = node.children ?? [];
  if (children.length === 0) {
    throw new Error("Telegraph content contains an element that cannot be paginated");
  }

  const emptyNode: TelegraphNode = { ...node, children: [] };
  const wrapperBytes = byteLength(JSON.stringify(emptyNode));
  const childMaxBytes = maxBytes - wrapperBytes - 2;
  if (childMaxBytes <= 0) {
    throw new Error("Telegraph content contains an element that cannot be paginated");
  }

  const childFragments: TelegraphNodeOrText[] = [];
  for (const child of children) {
    childFragments.push(...splitNode(child, childMaxBytes));
  }

  const chunks: TelegraphNodeOrText[] = [];
  let currentChildren: TelegraphNodeOrText[] = [];
  for (const child of childFragments) {
    const candidate: TelegraphNode = { ...node, children: [...currentChildren, child] };
    if (byteLength(JSON.stringify(candidate)) <= maxBytes) {
      currentChildren.push(child);
      continue;
    }

    if (currentChildren.length === 0) {
      throw new Error("Telegraph content contains an element that cannot be paginated");
    }
    chunks.push({ ...node, children: currentChildren });
    currentChildren = [child];
  }

  if (currentChildren.length > 0) {
    chunks.push({ ...node, children: currentChildren });
  }
  return chunks;
}

// Split on actual serialized size. Node count is not a useful approximation
// because one image or paragraph can be much larger than all nearby nodes.
export function splitNodesIntoPages(nodes: TelegraphNodeOrText[]): TelegraphNodeOrText[][] {
  const pages: TelegraphNodeOrText[][] = [];
  let currentPage: TelegraphNodeOrText[] = [];
  const maxNodeBytes = MAX_PAGE_CONTENT_BYTES - 2;

  for (const node of nodes) {
    const fragments = splitNode(node, maxNodeBytes);
    for (const fragment of fragments) {
      const candidate = [...currentPage, fragment];
      if (
        currentPage.length > 0 &&
        telegraphContentBytes(candidate) > MAX_PAGE_CONTENT_BYTES
      ) {
        pages.push(currentPage);
        currentPage = [fragment];
      } else {
        currentPage = candidate;
      }
    }
  }

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [[]];
}

function nextPageNode(url: string): TelegraphNode {
  return {
    tag: "p",
    children: [{ tag: "a", attrs: { href: url }, children: ["Next page"] }],
  };
}

// Create pages from the end so each earlier page can link to the page that
// already exists. The first URL returned is therefore the reading entrypoint.
async function createMultiPage(
  title: string,
  authorUrl: string,
  pages: TelegraphNodeOrText[][],
  token: string
): Promise<{ url: string; pageCount: number }> {
  let nextLink = "";
  for (let i = pages.length - 1; i >= 0; i--) {
    const content = nextLink ? [...pages[i], nextPageNode(nextLink)] : pages[i];
    if (telegraphContentBytes(content) > MAX_CONTENT_BYTES) {
      throw new Error("Telegraph page content exceeds the safe size limit");
    }

    if (i < pages.length - 1) {
      await new Promise((r) => setTimeout(r, 3_000)); // 避免 Telegraph rate limit
    }
    const pageTitle = pages.length > 1 ? `${title} (${i + 1}/${pages.length})` : title;
    nextLink = await createPage(pageTitle, authorUrl, content, token);
  }
  return { url: nextLink, pageCount: pages.length };
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
  const pages = splitNodesIntoPages(nodes);

  if (pages.length === 1) {
    const url = await createPage(title, sourceUrl, pages[0], token);
    return { url, isMultiPage: false, pageCount: 1 };
  }

  const result = await createMultiPage(title, sourceUrl, pages, token);
  return { url: result.url, isMultiPage: true, pageCount: result.pageCount };
}

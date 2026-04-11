import { mercuryParse, type ParseResult } from "./mercury";
import { readabilityParse } from "./readability";
import { fetchWithPuppeteer } from "./puppet";
import { sanitize } from "../utils/sanitize";

export type { ParseResult };

// 页面被拦截或内容不可用时的特征字符串
const BLOCKED_PATTERNS = [
  "该内容已被发布者删除",      // 微信：文章已删除
  "请在微信客户端打开链接",     // 微信：需要微信 App
  "此内容因违规无法查看",       // 微信：内容违规
];

function isBlocked(content: string): boolean {
  const text = content.replace(/<[^>]+>/g, "");
  return BLOCKED_PATTERNS.some((p) => text.includes(p));
}

function isTooShort(content: string): boolean {
  return sanitize(content).replace(/<[^>]+>/g, "").trim().length < 50;
}

export async function parseUrl(url: string): Promise<ParseResult> {
  // Step 1: 先用 Mercury 直接解析（不渲染 JS）
  let result = await mercuryParse(url);

  // Step 2: 若内容为空或被拦截，用 Puppeteer 渲染后再用 Mercury 解析
  if (!result || isTooShort(result.content) || isBlocked(result.content)) {
    const html = await fetchWithPuppeteer(url);

    // Mercury with rendered HTML
    result = await mercuryParse(url, html);

    // Step 3: Mercury 还是空，fallback 到 Readability
    if (!result || isTooShort(result.content)) {
      result = await readabilityParse(url, html);
    }
  }

  if (!result) {
    throw new Error("Failed to extract content from URL");
  }

  // 最终清洗
  result.content = sanitize(result.content);
  result.title = result.title.trim() || "Untitled";

  // 拦截页或内容过少：报错而非创建空 IV
  if (isBlocked(result.content)) {
    throw new Error("Content unavailable (deleted or requires app to view)");
  }
  if (isTooShort(result.content)) {
    throw new Error("Failed to extract content from URL");
  }

  return result;
}

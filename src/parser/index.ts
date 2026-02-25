import { mercuryParse, type ParseResult } from "./mercury";
import { readabilityParse } from "./readability";
import { fetchWithPuppeteer } from "./puppet";
import { sanitize } from "../utils/sanitize";

export type { ParseResult };

export async function parseUrl(url: string): Promise<ParseResult> {
  // Step 1: 先用 Mercury 直接解析（不渲染 JS）
  let result = await mercuryParse(url);

  // Step 2: 若内容为空，用 Puppeteer 渲染后再用 Mercury 解析
  if (!result || !sanitize(result.content).trim()) {
    const html = await fetchWithPuppeteer(url);

    // Mercury with rendered HTML
    result = await mercuryParse(url, html);

    // Step 3: Mercury 还是空，fallback 到 Readability
    if (!result || !sanitize(result.content).trim()) {
      result = await readabilityParse(url, html);
    }
  }

  if (!result) {
    throw new Error("Failed to extract content from URL");
  }

  // 最终清洗
  result.content = sanitize(result.content);
  result.title = result.title.trim() || "Untitled";

  return result;
}

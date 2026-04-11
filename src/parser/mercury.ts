import Mercury from "@postlight/parser";
import { WECHAT_UA } from "./puppet";

export interface ParseResult {
  title: string;
  content: string;
  url: string;
  author?: string;
}

const MERCURY_TIMEOUT_MS = 15_000;

export async function mercuryParse(
  url: string,
  html?: string
): Promise<ParseResult | null> {
  try {
    const opts: Record<string, unknown> = {};
    if (html) opts.html = Buffer.from(html);
    if (!html && url.includes("mp.weixin")) {
      opts.headers = { "User-Agent": WECHAT_UA };
    }
    const result = await Promise.race([
      Mercury.parse(url, opts),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Mercury timeout")), MERCURY_TIMEOUT_MS)
      ),
    ]);
    if (!result?.content) return null;
    return {
      title: (result.title as string | undefined) ?? "Untitled",
      content: result.content,
      url: (result.url as string | undefined) ?? url,
      author: (result.author as string | undefined) || undefined,
    };
  } catch {
    return null;
  }
}

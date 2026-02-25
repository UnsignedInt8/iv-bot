import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ParseResult {
  title: string;
  content: string;
  url: string;
}

export async function readabilityParse(
  url: string,
  html: string
): Promise<ParseResult | null> {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const result = reader.parse();
    if (!result?.content) return null;
    return {
      title: result.title ?? "Untitled",
      content: result.content,
      url,
    };
  } catch {
    return null;
  }
}

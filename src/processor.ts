import { parseUrl } from "./parser/index";
import { uploadToTelegraph } from "./telegraph/index";
import { normalizeUrl, isValidUrl, shouldSkipUrl } from "./utils/links";

export interface ProcessResult {
  ivUrl: string;
  title: string;
  isMultiPage: boolean;
  pageCount: number;
}

export async function processUrl(rawUrl: string): Promise<ProcessResult> {
  const url = normalizeUrl(rawUrl);

  if (!isValidUrl(url)) throw new Error("Invalid URL");
  if (shouldSkipUrl(url)) throw new Error("URL not supported (already IV, YouTube, or t.me)");

  const parsed = await parseUrl(url);
  const result = await uploadToTelegraph(parsed.title, parsed.url, parsed.content);

  return {
    ivUrl: result.url,
    title: parsed.title,
    isMultiPage: result.isMultiPage,
    pageCount: result.pageCount,
  };
}

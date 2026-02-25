import Mercury from "@postlight/parser";

export interface ParseResult {
  title: string;
  content: string;
  url: string;
}

export async function mercuryParse(
  url: string,
  html?: string
): Promise<ParseResult | null> {
  try {
    const opts: Record<string, unknown> = {};
    if (html) opts.html = Buffer.from(html);
    const result = await Mercury.parse(url, opts);
    if (!result?.content) return null;
    return {
      title: (result.title as string | undefined) ?? "Untitled",
      content: result.content,
      url: (result.url as string | undefined) ?? url,
    };
  } catch {
    return null;
  }
}

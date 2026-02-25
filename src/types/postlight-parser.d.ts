declare module "@postlight/parser" {
  interface ParseResult {
    title?: string;
    content?: string;
    url?: string;
    [key: string]: unknown;
  }
  interface ParseOptions {
    html?: Buffer;
    [key: string]: unknown;
  }
  function parse(url: string, options?: ParseOptions): Promise<ParseResult>;
  function addExtractor(extractor: unknown): void;
  export default { parse, addExtractor };
}

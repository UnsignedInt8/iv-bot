import sanitizeHtml from "sanitize-html";

// Telegraph 支持的标签白名单
const ALLOWED_TAGS = [
  "a", "aside", "b", "blockquote", "br", "code", "em",
  "figcaption", "figure", "h3", "h4", "hr", "i", "iframe",
  "img", "li", "ol", "p", "pre", "s", "strong", "u", "ul", "video",
];

export function sanitize(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
      iframe: ["src"],
      video: ["src"],
    },
    exclusiveFilter: (frame) =>
      frame.tag === "a" && !frame.attribs.href,
  });
}

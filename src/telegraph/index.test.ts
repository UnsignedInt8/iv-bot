import { describe, expect, test } from "bun:test";
import {
  MAX_CONTENT_BYTES,
  splitNodesIntoPages,
  telegraphContentBytes,
} from "./index";

function paragraph(text: string) {
  return { tag: "p", children: [text] };
}

describe("Telegraph pagination", () => {
  test("uses serialized byte size instead of node count", () => {
    const pages = splitNodesIntoPages([
      paragraph("a".repeat(55_000)),
      paragraph("b".repeat(10_000)),
      paragraph("c".repeat(10_000)),
    ]);

    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(telegraphContentBytes(page)).toBeLessThanOrEqual(MAX_CONTENT_BYTES);
    }
  });

  test("splits a single oversized text node across pages", () => {
    const text = "长内容 ".repeat(30_000);
    const pages = splitNodesIntoPages([paragraph(text)]);
    const reconstructed = pages
      .flat()
      .map((node) => (typeof node === "object" ? node.children?.[0] : node))
      .join("");

    expect(pages.length).toBeGreaterThan(1);
    expect(reconstructed).toBe(text);
    for (const page of pages) {
      expect(telegraphContentBytes(page)).toBeLessThanOrEqual(MAX_CONTENT_BYTES);
    }
  });
});

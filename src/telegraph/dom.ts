import { JSDOM } from "jsdom";

interface TelegraphNode {
  tag: string;
  attrs?: { href?: string; src?: string };
  children?: TelegraphNodeOrText[];
}

type TelegraphNodeOrText = TelegraphNode | string | false;

function domToNode(domNode: Node): TelegraphNodeOrText {
  if (domNode.nodeType === domNode.TEXT_NODE) {
    return (domNode as Text).data;
  }
  if (domNode.nodeType !== domNode.ELEMENT_NODE) {
    return false;
  }
  const el = domNode as Element;
  const node: TelegraphNode = {
    tag: el.tagName.toLowerCase(),
  };
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr.name === "href" || attr.name === "src") {
      if (!node.attrs) node.attrs = {};
      node.attrs[attr.name as "href" | "src"] = attr.value;
    }
  }
  if (el.childNodes.length > 0) {
    node.children = [];
    el.childNodes.forEach((child) => {
      node.children!.push(domToNode(child));
    });
  }
  return node;
}

// Telegraph IV requires proper block structure at the top level:
// - bare <img>  →  <figure><img /></figure>
// - <p> with only a single <img>  →  <figure><img /></figure>
// - bare text string  →  <p>text</p>
// - bare <br>  →  removed
function normalizeTopLevel(nodes: TelegraphNodeOrText[]): TelegraphNodeOrText[] {
  const out: TelegraphNodeOrText[] = [];
  for (const node of nodes) {
    if (node === false) continue;

    if (typeof node === "string") {
      const text = node.trim();
      if (text) out.push({ tag: "p", children: [text] });
      continue;
    }

    if (node.tag === "br") continue;

    if (node.tag === "img") {
      out.push({ tag: "figure", children: [node] });
      continue;
    }

    if (node.tag === "p") {
      const meaningful = (node.children ?? []).filter(
        (c): c is TelegraphNode | string =>
          c !== false && (typeof c !== "string" || c.trim() !== "")
      );
      if (
        meaningful.length === 1 &&
        typeof meaningful[0] === "object" &&
        (meaningful[0] as TelegraphNode).tag === "img"
      ) {
        out.push({ tag: "figure", children: [meaningful[0]] });
        continue;
      }
    }

    out.push(node);
  }
  return out;
}

export function htmlToTelegraphNodes(html: string): TelegraphNodeOrText[] {
  const dom = new JSDOM(`<!DOCTYPE html>${html}`).window.document;
  const body = domToNode(dom.body) as TelegraphNode;
  return normalizeTopLevel(body.children ?? []);
}

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

export function htmlToTelegraphNodes(html: string): TelegraphNodeOrText[] {
  const dom = new JSDOM(`<!DOCTYPE html>${html}`).window.document;
  const body = domToNode(dom.body) as TelegraphNode;
  return body.children ?? [];
}

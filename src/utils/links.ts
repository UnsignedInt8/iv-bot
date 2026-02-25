const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// 从文本中提取所有 URL
export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

// 从 Telegram entities 中提取 URL
export function extractUrlFromEntities(
  entities: Array<{ type: string; offset: number; length: number; url?: string }>,
  text: string
): string[] {
  const urls: string[] = [];
  for (const entity of entities) {
    if (entity.type === "url") {
      urls.push(text.slice(entity.offset, entity.offset + entity.length));
    } else if (entity.type === "text_link" && entity.url) {
      urls.push(entity.url);
    }
  }
  return urls;
}

// 跳过的域名：已经是 IV / 不支持的平台
const SKIP_PATTERNS = [
  /^https?:\/\/(www\.)?(graph\.org|telegra\.ph)/,
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/,
  /^https?:\/\/t\.me\//,
  /^https?:\/\/(www\.)?yandex\.ru\/showcap/,
];

export function shouldSkipUrl(url: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(url));
}

// 标准化 URL
export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u.match(/^https?:\/\//)) u = `https://${u}`;
  // 处理 Google 重定向
  const googleMatch = u.match(/[?&]url=([^&]+)/);
  if (googleMatch) return decodeURIComponent(googleMatch[1]);
  return u;
}

// 验证是否为合法 URL
export function isValidUrl(u: string): boolean {
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

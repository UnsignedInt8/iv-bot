import puppeteer, { type Browser } from "puppeteer";

export const WECHAT_UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 7 Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160289 MMWEBSDK/20260101 MMWEBID/5672 REV/d9bd9f73ab9a2b3cf0e05598dfe5f36c97321fc3 MicroMessenger/8.0.68.3003(0x28004443) WeChat/arm64 Weixin GPVersion/1 NetType/WIFI Language/en ABI/arm64";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--ignore-certificate-errors",
      "--lang=en",
    ],
  });
  return browser;
}

// 用 Puppeteer 获取完整渲染后的 HTML
export async function fetchWithPuppeteer(url: string): Promise<string> {
  const b = await getBrowser().catch((e) => {
    browser = null;
    throw e;
  });

  const page = await b.newPage().catch((e) => {
    browser = null;
    throw e;
  });

  try {
    if (url.includes("mp.weixin")) {
      await page.setUserAgent(WECHAT_UA);
    }
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    // 简单滚动触发懒加载
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise((r) => setTimeout(r, 1000));
    return await page.content();
  } catch (e) {
    // browser 本身崩溃时重置，确保下一次请求获得全新实例
    if (!b.connected) browser = null;
    throw e;
  } finally {
    // 不让 page.close() 的错误掩盖原始错误或产生 unhandled rejection
    await page.close().catch(() => {});
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

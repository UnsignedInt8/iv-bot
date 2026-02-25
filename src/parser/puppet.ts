import puppeteer, { type Browser } from "puppeteer";

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
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    // 简单滚动触发懒加载
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise((r) => setTimeout(r, 1000));
    return await page.content();
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

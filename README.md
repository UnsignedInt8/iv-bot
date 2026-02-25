# IV Bot

A stateless Telegram bot that converts any article URL into a [Telegraph Instant View](https://telegra.ph) link — no database, no queue, just paste and read.

一个无状态 Telegram Bot，将任意文章 URL 转换为 [Telegraph Instant View](https://telegra.ph) 链接 —— 无数据库，无消息队列，粘贴链接即用。

---

## How it works / 工作原理

```
User sends URL
    → Mercury parses HTML directly
    → (fallback) Puppeteer renders JS, Mercury parses again
    → (fallback) Mozilla Readability extracts content
    → Upload to Telegraph API
    → Reply with Instant View link
```

---

## Requirements / 环境要求

- [Bun](https://bun.sh) >= 1.0
- A Telegram Bot token from [@BotFather](https://t.me/BotFather)
- A Telegraph access token from [telegra.ph/api](https://telegra.ph/api#createAccount)

---

## Setup / 配置

**1. Install dependencies / 安装依赖**

```bash
bun install
```

**2. Configure environment / 配置环境变量**

```bash
cp .env.example .env
```

Edit `.env` / 编辑 `.env`：

```env
TBTKN=your_telegram_bot_token
TGPHTOKEN_0=your_telegraph_access_token
TGADMIN=your_telegram_user_id   # optional / 可选
```

To get a Telegraph token / 获取 Telegraph token：

```bash
curl -s "https://api.telegra.ph/createAccount?short_name=ivbot&author_name=IV+Bot" | jq .result.access_token
```

Multiple tokens are supported and rotated hourly (`TGPHTOKEN_0`, `TGPHTOKEN_1`, ...`TGPHTOKEN_9`).

支持多个 token，按小时轮换（`TGPHTOKEN_0` ~ `TGPHTOKEN_9`）。

**3. Run / 启动**

```bash
# Production / 生产
bun run start

# Development (auto-reload) / 开发（自动重载）
bun run dev
```

---

## Usage / 使用方法

Send any article URL to the bot in Telegram — that's it.

在 Telegram 中向 Bot 发送任意文章链接即可。

```
You:  https://example.com/some-article

Bot:  ✅ Article Title
      Source: https://example.com/some-article
```

**Supported / 支持：**
- Static HTML pages / 静态 HTML 页面
- JavaScript-rendered pages (React, Vue, etc.) / JS 渲染页面
- Long articles (auto split into multiple pages) / 长文章（自动分页）

**Not supported / 不支持：**
- YouTube links
- Telegram links (`t.me`)
- Existing Telegraph links (`telegra.ph`)
- PDF files

---

## Architecture / 架构

```
src/
├── index.ts              Entry point / 入口
├── bot.ts                Telegram message handler / 消息处理
├── processor.ts          Core pipeline / 核心流程
├── parser/
│   ├── index.ts          Parse pipeline / 解析管线
│   ├── mercury.ts        Mercury parser (@postlight/parser)
│   ├── readability.ts    Mozilla Readability fallback
│   └── puppet.ts         Puppeteer headless browser
├── telegraph/
│   ├── dom.ts            HTML → Telegraph nodes
│   └── index.ts          Telegraph API client
└── utils/
    ├── links.ts          URL extraction & validation
    └── sanitize.ts       HTML sanitization
```

**No database. No message queue. No cache.**
每次请求独立处理，无持久化依赖。

---

## License / 许可

MIT

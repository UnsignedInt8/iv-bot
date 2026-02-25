import { Telegraf } from "telegraf";
import { extractUrls, extractUrlFromEntities } from "./utils/links";
import { processUrl } from "./processor";

const START_MSG = `👋 Send me any article URL and I'll convert it to Telegram Instant View.\n\nJust paste a link — that's all!`;

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

const deleteUserMsg = process.env.DELETE_USER_MSG !== "false";

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.command(["start", "help"], (ctx) => ctx.reply(START_MSG));

  bot.on("message", async (ctx) => {
    const msg = ctx.message;
    if (!("text" in msg) && !("caption" in msg)) return;

    const text = ("text" in msg ? msg.text : (msg as { caption?: string }).caption) ?? "";
    const entities =
      ("entities" in msg ? msg.entities : (msg as { caption_entities?: unknown[] }).caption_entities) ?? [];

    // 提取 URL：优先 entities（更精确），其次正则
    let urls = extractUrlFromEntities(
      entities as Array<{ type: string; offset: number; length: number; url?: string }>,
      text
    );
    if (urls.length === 0) urls = extractUrls(text);
    if (urls.length === 0) return;

    const url = urls[0];
    const userMsgId = msg.message_id;
    const waiting = await ctx.reply("⏳ Processing...").catch(() => null);
    let success = false;

    try {
      const result = await processUrl(url);
      const pageInfo = result.isMultiPage ? ` (${result.pageCount} pages)` : "";
      const reply =
        `✅ [${escapeMarkdown(result.title)}](${result.ivUrl})${pageInfo}\n\n` +
        `Source: ${url}`;
      await ctx.reply(reply, { parse_mode: "Markdown" });
      success = true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await ctx.reply(`❌ Failed: ${errMsg}`);
    } finally {
      if (waiting) {
        await ctx.telegram.deleteMessage(ctx.chat.id, waiting.message_id).catch(() => {});
      }
      if (success && deleteUserMsg) {
        await ctx.telegram.deleteMessage(ctx.chat.id, userMsgId).catch(() => {});
      }
    }
  });

  return bot;
}

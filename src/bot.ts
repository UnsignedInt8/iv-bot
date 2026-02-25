import { Telegraf, type Telegram } from "telegraf";
import { extractUrls, extractUrlFromEntities, normalizeUrl, isValidUrl, shouldSkipUrl } from "./utils/links";
import { processUrl } from "./processor";
import { createQueue, popNext, makeQueueId } from "./pending";

const START_MSG = `👋 Send me any article URL and I'll convert it to Telegram Instant View.\n\nJust paste a link — that's all!`;

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

const deleteUserMsg = process.env.DELETE_USER_MSG !== "false";

interface NextButton {
  queueId: string;
  nextIndex: number;  // 下一条的序号（显示用）
  totalCount: number;
}

// 处理单个 URL 并发送结果，成功/失败都可选附带"继续"按钮
async function processAndReply(
  telegram: Telegram,
  chatId: number,
  url: string,
  next?: NextButton
): Promise<boolean> {
  const waiting = await telegram.sendMessage(chatId, "⏳ Processing...").catch(() => null);
  let success = false;

  const replyMarkup = next
    ? {
        inline_keyboard: [[{
          text: `继续下一个 URL (${next.nextIndex}/${next.totalCount})`,
          callback_data: `next:${next.queueId}`,
        }]],
      }
    : undefined;

  try {
    const result = await processUrl(url);
    const pageInfo = result.isMultiPage ? ` (${result.pageCount} pages)` : "";
    const text =
      `✅ [${escapeMarkdown(result.title)}](${result.ivUrl})${pageInfo}\n\n` +
      `Source: ${url}`;
    await telegram.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    success = true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await telegram.sendMessage(chatId, `❌ Failed: ${errMsg}`, {
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } finally {
    if (waiting) {
      await telegram.deleteMessage(chatId, waiting.message_id).catch(() => {});
    }
  }

  return success;
}

export function createBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.command(["start", "help"], (ctx) => ctx.reply(START_MSG));

  // 处理"继续下一个 URL"按钮点击
  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    if (!data?.startsWith("next:")) {
      await ctx.answerCbQuery();
      return;
    }

    await ctx.answerCbQuery(); // 立即 ack，消除按钮 loading 状态
    // 移除被点击消息上的按钮，防止重复点击
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});

    const queueId = data.slice(5);
    const item = popNext(queueId);
    if (!item) return; // 队列已过期或已空

    const chatId = ctx.callbackQuery.message?.chat.id ?? ctx.from.id;
    const next: NextButton | undefined = item.hasMore
      ? { queueId: item.queueId, nextIndex: item.nextIndex, totalCount: item.totalCount }
      : undefined;

    await processAndReply(ctx.telegram, chatId, item.url, next);
  });

  // 处理普通消息
  bot.on("message", async (ctx) => {
    const msg = ctx.message;
    if (!("text" in msg) && !("caption" in msg)) return;

    const text = ("text" in msg ? msg.text : (msg as { caption?: string }).caption) ?? "";
    const entities =
      ("entities" in msg ? msg.entities : (msg as { caption_entities?: unknown[] }).caption_entities) ?? [];

    // 提取 URL：优先 entities（更精确），其次正则
    let rawUrls = extractUrlFromEntities(
      entities as Array<{ type: string; offset: number; length: number; url?: string }>,
      text
    );
    if (rawUrls.length === 0) rawUrls = extractUrls(text);
    if (rawUrls.length === 0) return;

    // 标准化、去重、过滤不支持的 URL
    const urls = [...new Set(
      rawUrls.map(normalizeUrl).filter((u) => isValidUrl(u) && !shouldSkipUrl(u))
    )];
    if (urls.length === 0) return;

    const chatId = msg.chat.id;
    const userMsgId = msg.message_id;

    // 多个 URL：存入队列，处理第一个时附带按钮
    let next: NextButton | undefined;
    if (urls.length > 1) {
      const queueId = makeQueueId(chatId);
      createQueue(queueId, urls.slice(1), 1, urls.length);
      next = { queueId, nextIndex: 2, totalCount: urls.length };
    }

    const success = await processAndReply(ctx.telegram, chatId, urls[0], next);

    if (success && deleteUserMsg) {
      await ctx.telegram.deleteMessage(chatId, userMsgId).catch(() => {});
    }
  });

  return bot;
}

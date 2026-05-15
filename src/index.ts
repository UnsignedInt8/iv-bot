import { createBot } from "./bot";
import { closeBrowser } from "./parser/puppet";

const token = process.env.TBTKN;
if (!token) throw new Error("TBTKN environment variable is required");

const bot = createBot(token);

let stopping = false;

async function shutdown() {
  stopping = true;
  console.log("Shutting down...");
  await closeBrowser();
  await bot.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const NETWORK_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"]);

function isNetwork(err: unknown): boolean {
  return NETWORK_CODES.has((err as NodeJS.ErrnoException).code ?? "");
}

// Catch any ECONNRESET that escapes Telegraf's internals as an unhandled rejection
process.on("unhandledRejection", (err) => {
  if (isNetwork(err)) {
    console.warn(`Unhandled network error (${(err as NodeJS.ErrnoException).code}), bot will reconnect`);
  } else {
    console.error("Unhandled rejection:", err);
  }
});

// Same for synchronous throws
process.on("uncaughtException", (err) => {
  if (isNetwork(err)) {
    console.warn(`Uncaught network error (${(err as NodeJS.ErrnoException).code}), bot will reconnect`);
  } else {
    console.error("Uncaught exception:", err);
    process.exit(1);
  }
});

async function launch() {
  while (!stopping) {
    try {
      await bot.launch();
      console.log("Bot started (polling mode)");
    } catch (err: unknown) {
      if (stopping) break;
      const delay = isNetwork(err) ? 5000 : 15000;
      console.warn(`Bot error (${(err as NodeJS.ErrnoException).code ?? err}), reconnecting in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

launch();

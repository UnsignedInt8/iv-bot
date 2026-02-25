import { createBot } from "./bot";
import { closeBrowser } from "./parser/puppet";

const token = process.env.TBTKN;
if (!token) throw new Error("TBTKN environment variable is required");

const bot = createBot(token);

async function shutdown() {
  console.log("Shutting down...");
  await closeBrowser();
  await bot.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

bot.launch().then(() => {
  console.log("Bot started (polling mode)");
});

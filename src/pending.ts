const TTL_MS = 30 * 60 * 1000; // 30 分钟后过期

interface Queue {
  urls: string[];
  processedCount: number;
  totalCount: number;
  expiresAt: number;
}

const store = new Map<string, Queue>();

export function createQueue(
  id: string,
  remainingUrls: string[],
  processedCount: number,
  totalCount: number
): void {
  store.set(id, {
    urls: remainingUrls,
    processedCount,
    totalCount,
    expiresAt: Date.now() + TTL_MS,
  });
}

export interface NextItem {
  url: string;
  nextIndex: number;   // 下一条（本次处理完后）的序号，用于按钮显示
  totalCount: number;
  hasMore: boolean;    // 本次处理后队列是否还有剩余
  queueId: string;
}

export function popNext(id: string): NextItem | null {
  const q = store.get(id);
  if (!q || Date.now() > q.expiresAt || q.urls.length === 0) {
    store.delete(id);
    return null;
  }
  const url = q.urls.shift()!;
  q.processedCount += 1;
  const hasMore = q.urls.length > 0;
  if (!hasMore) store.delete(id);
  return {
    url,
    nextIndex: q.processedCount + 1, // 下一个的序号（处理完本条后再下一个）
    totalCount: q.totalCount,
    hasMore,
    queueId: id,
  };
}

export function makeQueueId(chatId: number): string {
  return `q${chatId}_${Date.now()}`;
}

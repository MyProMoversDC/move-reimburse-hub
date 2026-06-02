// Simple concurrency-limited task runner.
// Use to run N parallel uploads at a time without exhausting mobile radios.

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners: Promise<void>[] = [];
  const n = Math.max(1, Math.min(limit, items.length));

  for (let i = 0; i < n; i++) {
    runners.push(
      (async () => {
        while (true) {
          const current = cursor++;
          if (current >= items.length) return;
          results[current] = await worker(items[current], current);
        }
      })()
    );
  }

  await Promise.all(runners);
  return results;
}

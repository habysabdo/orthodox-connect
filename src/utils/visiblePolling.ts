interface VisiblePollingOptions {
  intervalMs: number;
  /** Run the task once straight away. Defaults to true. */
  immediate?: boolean;
  onError?: (error: unknown) => void;
}

export function startVisiblePolling(
  task: () => Promise<unknown>,
  { intervalMs, immediate = true, onError }: VisiblePollingOptions,
): () => void {
  let stopped = false;
  let running = false;

  const run = async () => {
    if (stopped || running || document.visibilityState === 'hidden') return;
    running = true;
    try {
      await task();
    } catch (error) {
      onError?.(error);
    } finally {
      running = false;
    }
  };

  const runWhenVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };

  if (immediate) void run();
  const interval = window.setInterval(() => void run(), intervalMs);
  document.addEventListener('visibilitychange', runWhenVisible);

  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', runWhenVisible);
  };
}

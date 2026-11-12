export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.ENABLE_IN_APP_WORKERS?.trim().toLowerCase() !== 'false'
  ) {
    const { startChatQueueWorker } = await import('@/services/chatQueueWorker');
    startChatQueueWorker();
  }
}


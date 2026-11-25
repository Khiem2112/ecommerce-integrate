export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.ENABLE_IN_APP_WORKERS?.trim().toLowerCase() !== 'false'
  ) {
    const [{ startChatQueueWorker }, { startLazadaSqsConsumer }] =
      await Promise.all([
        import('@/services/chatQueueWorker'),
        import('@/services/lazadaSqsConsumer'),
      ]);
    startChatQueueWorker();
    startLazadaSqsConsumer();
  }
}



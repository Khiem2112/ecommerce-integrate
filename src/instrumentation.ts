export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startChatQueueWorker } = await import('@/services/chatQueueWorker');
    startChatQueueWorker();
  }
}


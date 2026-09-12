import { NextResponse } from 'next/server';
import { triggerSyncWorker } from '@/services/connectors/syncWorkerService';

/**
 * Dedicated internal API route to trigger worker processing.
 */
export async function POST() {
  try {
    // Non-blocking trigger in background
    setImmediate(() => {
      triggerSyncWorker().catch((err) => {
        console.error('[API /api/sync/process] Worker execution error:', err);
      });
    });

    return NextResponse.json({ success: true, message: 'Worker triggered' });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

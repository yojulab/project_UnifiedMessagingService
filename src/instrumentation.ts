export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.MONGODB_URI) {
    const { startDispatchScheduler } = await import('@/lib/dispatch/scheduler');
    startDispatchScheduler();
  }
}

import {NodeSDK} from '@opentelemetry/sdk-node';
import {LangfuseSpanProcessor} from '@langfuse/otel';
import {startActiveObservation, propagateAttributes} from '@langfuse/tracing';
import {tracingConfig, redact} from './trace-policy.mjs';

let sdk: NodeSDK | undefined;
let stopped = false;
export function initializeTracing() {
  if (sdk || process.env.LOOKOUT_TRACING_ENABLED === 'false') return;
  try {
    const config = tracingConfig();
    if (!config) return;
    sdk = new NodeSDK({serviceName: 'lookout-backend', spanProcessors: [new LangfuseSpanProcessor({
      ...config, environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || 'development',
      mediaUploadEnabled: false, mask: ({data}) => redact(data),
      shouldExportSpan: ({otelSpan}) => otelSpan.instrumentationScope.name === 'langfuse-sdk',
    })]});
    sdk.start();
    process.once('beforeExit', () => { void shutdownTracing(); });
  } catch { sdk = undefined; console.error('Lookout tracing initialization failed; application remains available.'); }
}
export async function shutdownTracing() {
  if (!sdk || stopped) return;
  stopped = true;
  try { await sdk.shutdown(); } catch { console.error('Lookout tracing flush failed.'); }
}
// Callers pass explicitly selected structural fields only, never auth or record bodies.
export async function traceWork<T>(name: string, input: Record<string, unknown>, work: () => Promise<T>,
  options: {sessionId?: string; type?: 'tool' | 'span'; summarize?: (value: T) => Record<string, unknown>} = {}): Promise<T> {
  if (!sdk || stopped) return work();
  let entered = false, failed = false, failure: unknown, value!: T;
  try {
    await propagateAttributes({tags: ['lookout', 'backend'], ...(options.sessionId ? {sessionId: options.sessionId} : {})}, () =>
      (async () => { const callback = async (span: {update: (data: any) => unknown}) => {
        try { span.update({input: redact(input)}); } catch { /* Observability cannot suppress work. */ }
        entered = true;
        try { value = await work(); } catch (error) { failed = true; failure = error; }
        try {
          const output = failed ? {status: 'failed'} : options.summarize?.(value) || {status: 'completed'};
          const bad = failed || typeof output.status === 'number' && output.status >= 400 || output.status === 'failed';
          span.update({output: redact(output), ...(bad ? {level: 'ERROR', statusMessage: 'Operation failed; inspect local diagnostics'} : {})});
        } catch { /* Preserve original result/error and do not capture raw exceptions. */ }
      }; return options.type === 'tool' ? startActiveObservation(name, callback, {asType: 'tool'}) : startActiveObservation(name, callback); })());
  } catch {
    console.error('Lookout tracing failed; operation outcome preserved.');
    if (!entered) return work();
  }
  if (failed) throw failure;
  return value;
}

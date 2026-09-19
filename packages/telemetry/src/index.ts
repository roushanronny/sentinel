import { metrics, trace, SpanStatusCode, type Tracer, type Meter } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let initialized = false;

export interface TelemetryHandles {
  tracer: Tracer;
  meter: Meter;
}

export function initTelemetry(
  serviceName: string,
  options?: { enableConsoleExport?: boolean },
): TelemetryHandles {
  if (!initialized) {
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    });

    const traceProvider = new NodeTracerProvider({ resource });
    if (options?.enableConsoleExport) {
      const base = new BasicTracerProvider({ resource });
      base.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    }

    // NodeTracerProvider.register may exist depending on SDK version.
    if (typeof (traceProvider as { register?: () => void }).register === 'function') {
      (traceProvider as { register: () => void }).register();
    } else {
      trace.setGlobalTracerProvider(traceProvider);
    }

    const meterProvider = new MeterProvider({
      resource,
      readers: options?.enableConsoleExport
        ? [
            new PeriodicExportingMetricReader({
              exporter: new ConsoleMetricExporter(),
              exportIntervalMillis: 60_000,
            }),
          ]
        : [],
    });
    metrics.setGlobalMeterProvider(meterProvider);
    initialized = true;
  }

  return {
    tracer: trace.getTracer(serviceName),
    meter: metrics.getMeter(serviceName),
  };
}

export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export { trace, metrics, SpanStatusCode };

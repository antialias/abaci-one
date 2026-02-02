/**
 * OpenTelemetry Instrumentation Bootstrap
 *
 * This file must be loaded BEFORE any other modules via:
 *   node --require ./instrumentation.js server.js
 *
 * Environment variables:
 * - OTEL_ENABLED: Set to 'true' to enable tracing
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Tempo endpoint (default: http://tempo:4317)
 * - OTEL_SERVICE_NAME: Service name for traces (default: abaci-app)
 */

const isEnabled =
  process.env.OTEL_ENABLED === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.KUBERNETES_SERVICE_HOST)

if (isEnabled) {
  const { NodeSDK } = require('@opentelemetry/sdk-node')
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc')
  const { resourceFromAttributes } = require('@opentelemetry/resources')
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
    ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  } = require('@opentelemetry/semantic-conventions')

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://tempo:4317'
  const serviceName = process.env.OTEL_SERVICE_NAME || 'abaci-app'
  const serviceVersion = process.env.npm_package_version || '0.0.0'
  const environment = process.env.NODE_ENV || 'development'
  const podName = process.env.HOSTNAME || 'unknown'

  console.log(
    `[Tracing] Initializing OpenTelemetry - endpoint: ${endpoint}, service: ${serviceName}, pod: ${podName}`
  )

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
    'k8s.pod.name': podName,
  })

  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
  })

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingPaths: [
            /^\/api\/health/,
            /^\/api\/metrics/,
            /^\/api\/heartbeat/,
            /^\/_next\/static/,
            /^\/favicon\.ico/,
          ],
        },
      }),
    ],
  })

  sdk.start()
  console.log('[Tracing] OpenTelemetry SDK started')

  // Graceful shutdown
  const shutdown = () => {
    sdk
      .shutdown()
      .then(() => console.log('[Tracing] SDK shut down successfully'))
      .catch((error) => console.error('[Tracing] Error shutting down SDK:', error))
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
} else {
  console.log('[Tracing] OpenTelemetry disabled (set OTEL_ENABLED=true or run in k8s to enable)')
}

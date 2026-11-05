/**
 * Azure Application Insights connection string.
 *
 * The connection string is not a secret: it is a write-only ingestion endpoint
 * and is safe to hardcode in an extension. Leave it empty to disable reporting
 * entirely (the telemetry service then becomes a no-op).
 */
export const TELEMETRY_CONNECTION_STRING =
    "InstrumentationKey=5f924d6a-2869-4186-9a7f-56bc688da562;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/;ApplicationId=561591fa-4bac-4ed2-8bb9-4b044560660d";

/** Key used to persist the anonymous installation ID in `ExtensionContext.globalState`. */
export const TELEMETRY_INSTALL_ID_KEY = "pintia.telemetry.installationId";

/** Set to "1" to print telemetry events to the output channel without sending them. */
export const TELEMETRY_DEBUG_ENV = "PINTIA_TELEMETRY_DEBUG";

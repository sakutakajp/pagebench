import { observationSummary, observationPublicSummary } from './observation-summary.mjs';
import { safeNuxtErrorEvidence } from './nuxt-error-evidence.mjs';
export function nuxtErrorObservationSummary(native) {
  const base = observationSummary(native);
  if (['ERROR_OBSERVER_MODE', 'ERROR_OBSERVER_INSTALL'].includes(native?.reason)) base.reason = native.reason;
  return { ...base, nuxt_error: safeNuxtErrorEvidence(native?.nuxt_error), error_observation_role: 'APP_REPORTED_WITH_GAPS' };
}
export function nuxtErrorPublicSummary(value) {
  const keys = Object.keys(nuxtErrorObservationSummary(null));
  if (!value || Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k)) || value.error_observation_role !== 'APP_REPORTED_WITH_GAPS') return nuxtErrorObservationSummary(null);
  const { nuxt_error, error_observation_role, ...base } = value;
  const projected = observationPublicSummary(base);
  if (['ERROR_OBSERVER_MODE', 'ERROR_OBSERVER_INSTALL'].includes(base.reason)) projected.reason = base.reason;
  return { ...projected, nuxt_error: safeNuxtErrorEvidence(nuxt_error), error_observation_role: 'APP_REPORTED_WITH_GAPS' };
}

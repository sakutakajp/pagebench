// Test-only module seam: keep all original exports, replace only browser opener.
export * from '../cdp-startup-diagnostic/fixture-runner.mjs';
export {controlledBaseOpen as openGuarded} from './wiring-base.mjs';

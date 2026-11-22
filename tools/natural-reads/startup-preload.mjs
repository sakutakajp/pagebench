// Preload before entry module linking. No message listeners or exception handlers
// that consume/suppress Node's original exit/stderr behavior.
import{installStartupEvidence}from'./startup-evidence.mjs';
installStartupEvidence(process.env.PB_NATURAL_DIRECTORY);

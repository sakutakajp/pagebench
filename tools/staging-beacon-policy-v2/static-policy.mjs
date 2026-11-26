import{allowed as base}from'../staging-measurement-policy/static-policy.mjs';import{beaconRead}from'./beacon-read.mjs';
export function allowed(r,type,icons){return beaconRead(r,type)||base(r,type,icons);}

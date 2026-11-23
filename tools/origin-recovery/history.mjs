// Test-only exact reviewed deltas. No test is skipped and all other bytes stay pinned.
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
const DELTAS={
  "tools/natural-reads/test.mjs": {
    "current": "ded43212a8958182d31cc5f2bac03d76d1e87fe3bba38ba22025fb13bebaae44",
    "historical": [
      "75b02a9a43fc13d9287f8a5246b0c0d1018f29a9f883c16a9064857d4542ddb5"
    ]
  },
  "tools/natural-reads/live.test.mjs": {
    "current": "c5dab6be8568d2ae4d7492e5123b0955dcc9cef036afde94ce79580b1ea7b8d4",
    "historical": [
      "6b2342ce45c7df86ede34f7c91e222e421086b8b039dab99d251592d843aac7c"
    ]
  },
  "tools/natural-reads/fixture-stop.test.mjs": {
    "current": "8acfebf487b26284d5fb1de79b1b116a1a59ad16c1bc112771a4c14d8c437df7",
    "historical": [
      "00c550fbb6b5b7817847f6b2fa74c016410f13ed0198cca9cefbd48c9ff6abc2",
      "98ecc989d9f51633561f47358b10740858dda8519bee5923926208b53abe3efe"
    ]
  },
  "tools/natural-reads/stop-record.test.mjs": {
    "current": "4925c16ae4ee5641dc74cf1f63362afd6155fdfc37626bc643a0c65c4ef24248",
    "historical": [
      "21d8b0638a4dd9274140cb60b446ac0fa7d962c13e0d80ce83a229699c04e38c"
    ]
  },
  "tools/natural-reads/scoped400.test.mjs": {
    "current": "a4014f08442b84691aa4caf9c99638269af4d98061b5a086e1a0323d6f2bcc93",
    "historical": [
      "7dba6342783831d6af97110cda24a608b9be5c494880b11d46dfb7d2dfbd4fc4"
    ]
  },
  "tools/natural-reads/startup400.test.mjs": {
    "current": "618791c78c68147e13e4612f60c1f86ece6ee7b0a5366778c89833bf388a972f",
    "historical": [
      "b50d060d99fde7001f3e8b108b418f6503451a2c59522aaaa5442848861602a7"
    ]
  },
  "tools/natural-reads/handled-integration.test.mjs": {
    "current": "b237505deeb88672fb1e8b23d95201542b0dfa8d6988748e42736c56ceedb914",
    "historical": [
      "b091dc211b7e62338036ca05b753af8699aa5160df3b87cc32f3c1064acbed02"
    ]
  },
  "tools/origin-capture/test.mjs": {
    "current": "0cfbfbfb152e4465a44822078c4d40e4b6c441ebcf3b9d1da1c20d6f2fdd774d",
    "historical": [
      "13dc8699ff165b9d7dd80d08e7a6d6260a42508990c37e2c0273f26d36e802b8"
    ]
  },
  "tools/origin-capture/once.test.mjs": {
    "current": "95c4059d783f2135af25bbf92fbb2cb657541816f61232bc1359be8ce571bad2",
    "historical": [
      "a78ad2859841ce79d07a9775dce1181007bb4e7faf172c1d099cd6593334711a"
    ]
  },
  "tools/nuxt-debug/natural-prefetch-proxy.mjs": {
    "current": "28fa2734da84b6f62aba2407b0bab0807f82fa77deab4966aafb65320f4bef3a",
    "historical": [
      "28fa2734da84b6f62aba2407b0bab0807f82fa77deab4966aafb65320f4bef3a",
      "536bb16bcf0a4b3ec4500645797392f72db1fcfe60f35ebb79ad0b8634f56a33"
    ]
  },
  "tools/origin-capture/crypto.mjs": {
    "current": "dad70ab4f7c8dce8eb2c2a13316af15174d13c9356af891982aeaf39385f3e7d",
    "historical": [
      "24c94d47b3c401047e2fea5479ed29b97e89cb074ab117e39d8c87c0143f8a4e"
    ]
  }
};
const hash=b=>createHash('sha256').update(b).digest('hex');
export function reviewedHistoricalEqual(path,current,before){const d=DELTAS[path];return d?hash(current)===d.current&&d.historical.includes(hash(before)):Buffer.from(current).equals(Buffer.from(before));}
export function assertReviewedHistoricalFile(path,before){assert(reviewedHistoricalEqual(path,readFileSync(path),before),'FIXED_HISTORICAL_SOURCE_MISMATCH');}
export const REVIEWED_PATHS=Object.freeze(Object.keys(DELTAS));

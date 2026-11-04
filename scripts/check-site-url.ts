import assert from "node:assert/strict";
import { resolveSiteUrl } from "../lib/site-url";

for (const old of ["https://www.ajentmedia.com", "https://ajentmedia.com/", "http://www.ajentmedia.com:3000/"]) {
  assert.equal(resolveSiteUrl(old), "https://judystudiox.com");
}
assert.equal(resolveSiteUrl("https://judystudiox.com/"), "https://judystudiox.com");
assert.equal(resolveSiteUrl("http://localhost:3101"), "http://localhost:3101");
assert.equal(resolveSiteUrl("https://preview.example.com"), "https://preview.example.com");
assert.equal(resolveSiteUrl(), "http://localhost:3000");
assert.throws(() => resolveSiteUrl("not-a-url"));
console.log("Site URL checks passed, including retired production domains.");

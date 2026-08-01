import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://actionparity.com/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the ActionParity landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-CN"/i);
  assert.match(html, /<title>ActionParity（影核）— 一个动作，所有界面 \/ One action\. Every interface\.<\/title>/i);
  assert.match(html, /一个动作/);
  assert.match(html, /所有界面/);
  assert.match(html, /Action Core/);
  assert.match(html, /影子里，不许有这四样东西/);
  assert.match(html, /THE ACTIONPARITY MANIFESTO/);
  assert.match(html, /Software has a new kind of user/);
  assert.match(html, /软件迎来了一种新的用户/);
  assert.match(html, /Open standards create larger markets/);
  assert.match(html, /开放标准会创造更大的商业市场/);
  assert.match(html, /github\.com\/dongsheng123132\/action-parity/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
});

test("publishes discoverable metadata", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /<link[^>]*rel="canonical"[^>]*href="https:\/\/actionparity\.com\/"/i);
  assert.match(html, /<meta[^>]*property="og:title"[^>]*ActionParity/i);
  assert.match(html, /<meta[^>]*name="twitter:card"[^>]*summary_large_image/i);
  assert.match(html, /<meta[^>]*name="robots"[^>]*index/i);
  assert.doesNotMatch(html, /og:image|twitter:image/i);
});

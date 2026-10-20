import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { once } from "node:events";
import { createRequire } from "node:module";

// Real browser/server integration, isolated from the school's database and GitHub.
const require = createRequire(import.meta.url);
const { createApp } = require("../server");
const { createTLS } = require("../studio/network");
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const source = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-phone-qa-"));
const screenshots = path.join(root, "screenshots");
fs.mkdirSync(screenshots);
fs.cpSync(path.join(source, "public"), path.join(root, "public"), {
  recursive: true,
});
fs.mkdirSync(path.join(root, "docs", "assets"), { recursive: true });
const fixture = {
  series: [
    {
      num: 1,
      description: "Test isolé",
      questions: [
        { num: 1, img: "", audio: "", audio_explination: "", answer: ["1"] },
      ],
    },
  ],
};
const original = JSON.stringify(fixture);
fs.writeFileSync(path.join(root, "db.json"), original);
fs.writeFileSync(path.join(root, "docs", "db.js"), "let database=" + original);
const options = { root, tls: createTLS(root) };
const app = createApp(options);
const web = http.createServer(app).listen(0, "0.0.0.0");
const secure = https.createServer(options.tls, app).listen(0, "0.0.0.0");
await Promise.all([once(web, "listening"), once(secure, "listening")]);
options.port = web.address().port;
options.httpsPort = secure.address().port;
const origin = "http://127.0.0.1:" + options.port;
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--no-proxy-server",
  ],
  ...(process.env.QA_CHROMIUM_PATH
    ? { executablePath: process.env.QA_CHROMIUM_PATH }
    : {}),
});
const errors = [];
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ignoreHTTPSErrors: true,
  permissions: ["microphone"],
});
const pc = await desktop.newPage();
const mobile = await phone.newPage();
for (const page of [pc, mobile])
  page.on("pageerror", (error) => errors.push(error.message));
const read = () =>
  JSON.parse(fs.readFileSync(path.join(root, "db.json"), "utf8"));
try {
  await pc.goto(origin);
  await pc.waitForFunction(
    () => document.querySelector("#selectedQuestion-num").textContent === "1",
  );
  await pc.locator("#openPhone").click();
  await pc.locator("#phoneQr").waitFor({ state: "visible" });
  const pairingUrl = await pc.locator("#phoneLink").getAttribute("href");
  const lan = new URL(pairingUrl).origin;
  assert.equal(
    (await phone.request.get(lan + "/series")).status(),
    401,
    "LAN needs pairing",
  );
  await pc.screenshot({
    path: path.join(screenshots, "desktop-phone-pairing.png"),
    fullPage: true,
  });
  await mobile.goto(pairingUrl);
  await mobile.waitForURL(lan + "/");
  await mobile.waitForFunction(
    () => document.querySelector("#selectedQuestion-num").textContent === "1",
  );
  assert.equal(
    (await phone.request.get(lan + "/series")).status(),
    200,
    "paired phone authorized",
  );
  assert.equal(
    (
      await phone.request.post(lan + "/api/pairing/consume", {
        data: { token: new URL(pairingUrl).hash.split("=")[1] },
      })
    ).status(),
    410,
    "QR single use",
  );
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    ),
    false,
  );
  await mobile.screenshot({
    path: path.join(screenshots, "mobile-admin.png"),
    fullPage: true,
  });
  await pc.locator("#closePhoneDialog").click();

  for (const [button, field, player] of [
    ["phone-question-audio", "audio", "question-audio-player"],
    [
      "phone-explanation-audio",
      "audio_explination",
      "explanation-audio-player",
    ],
  ]) {
    await pc.locator("#" + button).click();
    await pc.locator("#phoneQr").waitFor({ state: "visible" });
    const url = await pc.locator("#phoneLink").getAttribute("href");
    await pc.locator('[data-qr-mode="certificate"]').click();
    assert.ok(
      (await pc.locator("#phoneLink").getAttribute("href")).endsWith(
        "/studio-certificate.crt",
      ),
    );
    await pc.locator('[data-qr-mode="native"]').click();
    assert.ok(
      (await pc.locator("#phoneLink").getAttribute("href")).startsWith(
        "http://",
      ),
    );
    await pc.locator('[data-qr-mode="secure"]').click();
    assert.equal(await pc.locator("#phoneLink").getAttribute("href"), url);
    const before = JSON.stringify(read());
    // A separate, unpaired phone may send only the audio, never edit the database.
    const voiceContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      ignoreHTTPSErrors: true,
      permissions: ["microphone"],
    });
    const voice = await voiceContext.newPage();
    voice.on("pageerror", (error) => errors.push(error.message));
    await voice.goto(url);
    await voice.waitForFunction(
      () => !document.querySelector("#recordVoice").disabled,
    );
    assert.equal(
      (
        await voiceContext.request.get(new URL(url).origin + "/series")
      ).status(),
      401,
    );
    await voice.locator("#recordVoice").click();
    await voice.waitForFunction(() =>
      document.querySelector("#recordVoice").classList.contains("recording"),
    );
    await voice.waitForFunction(
      () => document.querySelector("#recordTimer").textContent === "00:01",
    );
    await voice.locator("#recordVoice").click();
    await voice.waitForFunction(
      () => !document.querySelector("#submitVoice").disabled,
    );
    assert.equal(
      await voice.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
    );
    await voice.screenshot({
      path: path.join(screenshots, "mobile-" + field + "-ready.png"),
      fullPage: true,
    });
    await voice.locator("#submitVoice").click();
    await voice.getByText("✓ Audio envoyé au PC", { exact: true }).waitFor();
    await pc.waitForFunction(
      () => !document.querySelector("#phoneDialog").open,
    );
    assert.ok(
      (await pc.locator("#" + player).getAttribute("src")).startsWith("blob:"),
      "Audio automatically in desktop draft",
    );
    assert.equal(
      JSON.stringify(read()),
      before,
      "Phone submit doesn't overwrite database",
    );
    await pc.locator("#saveQuestion").click();
    await pc.waitForFunction(() =>
      document
        .querySelector("#saveStatusText")
        .textContent.includes("Toutes les modifications"),
    );
    const saved = read().series[0].questions[0][field];
    assert.ok(saved.startsWith("assets/new_series/"));
    assert.ok(
      fs.statSync(path.join(root, "docs", saved)).size > 12,
      "Real recorded audio stored by Save",
    );
    await voiceContext.close();
  }
  assert.deepEqual(
    fs.readdirSync(path.join(root, ".studio", "transfers")),
    [],
    "Received temporary recordings cleaned",
  );
  await pc.locator("#phone-question-audio").click();
  await pc.locator("#phoneQr").waitFor({ state: "visible" });
  const canceled = await pc.locator("#phoneLink").getAttribute("href");
  await pc.locator("#closePhoneDialog").click();
  await mobile.goto(canceled);
  await mobile.waitForFunction(() =>
    document.querySelector("#recordMessage").textContent.includes("expiré"),
  );
  assert.equal(await mobile.locator("#recordVoice").isDisabled(), true);
  assert.deepEqual(errors, []);
  await pc.screenshot({
    path: path.join(screenshots, "desktop-audio-received.png"),
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        scenarios: [
          "LAN authentication",
          "single-use pairing",
          "phone admin",
          "scoped microphone recording",
          "desktop question audio receipt/save",
          "desktop explanation audio receipt/save",
          "cancel invalidates token",
          "temporary cleanup",
        ],
        screenshots,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  app.locals.close();
  web.closeAllConnections();
  secure.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => web.close(resolve)),
    new Promise((resolve) => secure.close(resolve)),
  ]);
}

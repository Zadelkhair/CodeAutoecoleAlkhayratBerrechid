import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

// Explicitly target an installed studio over a localhost SSH tunnel. Never Save or Publish.
const origin = process.env.QA_REMOTE_ORIGIN;
if (!origin || new URL(origin).hostname !== "127.0.0.1")
  throw new Error(
    "QA_REMOTE_ORIGIN must be a localhost SSH tunnel to the installed studio.",
  );
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
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
const screenshots = fs.mkdtempSync(
  path.join(os.tmpdir(), "studio-windows-qa-"),
);
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
try {
  const before = await desktop.request
    .get(origin + "/series")
    .then((r) => r.json());
  assert.ok(before.length > 0);
  await pc.goto(origin);
  await pc.waitForFunction(
    () => document.querySelector("#selectedQuestion-num").textContent !== "—",
  );
  await pc.locator("#openPhone").click();
  await pc.locator("#phoneQr").waitFor({ state: "visible" });
  const pairUrl = await pc.locator("#phoneLink").getAttribute("href");
  const lan = new URL(pairUrl).origin;
  assert.equal((await phone.request.get(lan + "/series")).status(), 401);
  await mobile.goto(pairUrl);
  await mobile.waitForURL(lan + "/");
  await mobile.waitForFunction(
    () => document.querySelector("#totalSeries").textContent !== "0",
  );
  assert.equal((await phone.request.get(lan + "/series")).status(), 200);
  await mobile.screenshot({
    path: path.join(screenshots, "windows-admin-on-phone.png"),
    fullPage: true,
  });
  await pc.locator("#closePhoneDialog").click();
  await pc.locator("#phone-explanation-audio").click();
  await pc.locator("#phoneQr").waitFor({ state: "visible" });
  const recordUrl = await pc.locator("#phoneLink").getAttribute("href");
  await mobile.goto(recordUrl);
  await mobile.waitForFunction(
    () => !document.querySelector("#recordVoice").disabled,
  );
  await mobile.locator("#recordVoice").click();
  await mobile.waitForFunction(
    () => document.querySelector("#recordTimer").textContent === "00:01",
  );
  await mobile.locator("#recordVoice").click();
  await mobile.waitForFunction(
    () => !document.querySelector("#submitVoice").disabled,
  );
  await mobile.screenshot({
    path: path.join(screenshots, "windows-phone-recording.png"),
    fullPage: true,
  });
  await mobile.locator("#submitVoice").click();
  await mobile.getByText("✓ Audio envoyé au PC", { exact: true }).waitFor();
  await pc.waitForFunction(() => !document.querySelector("#phoneDialog").open);
  assert.ok(
    (
      await pc.locator("#explanation-audio-player").getAttribute("src")
    ).startsWith("blob:"),
  );
  assert.match(
    await pc.locator("#saveStatusText").textContent(),
    /non enregistrées/,
  );
  assert.deepEqual(
    await desktop.request.get(origin + "/series").then((r) => r.json()),
    before,
    "Installation QA must not modify school content",
  );
  const verification = await desktop.request.post(origin + "/api/git/verify");
  const git = await verification.json();
  assert.equal(verification.status(), 200, git.message);
  assert.equal(git.ok, true);
  assert.deepEqual(errors, []);
  await pc.screenshot({
    path: path.join(screenshots, "windows-desktop-received.png"),
    fullPage: true,
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        series: before.length,
        lan,
        databaseUnchanged: true,
        gitVerified: true,
        phoneAudioReceived: true,
        screenshots,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}

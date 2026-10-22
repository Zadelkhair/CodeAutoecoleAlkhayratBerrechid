import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.QA_ORIGIN || "http://127.0.0.1:5080";
const screenshots = fs.mkdtempSync(path.join(os.tmpdir(), "correction-classic-"));
const source = JSON.parse(fs.readFileSync(new URL("../db.json", import.meta.url)));
const image = source.series.flatMap((serie) => serie.questions).find((q) => q.img).img;
const answers = [1, 2, 3].map((num) => ({
  question: { num, img: image, answer: ["1"], audio_explination: num === 2 ? "assets/qa-audio.mp3" : "" },
  userAnswer: [num === 1 ? "1" : "2"],
  isCorrect: num === 1,
}));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}),
});
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Block third-party comments and all writes. QA uses only its own browser storage.
    await page.route("**/*", (route) => {
      const request = route.request();
      if (new URL(request.url()).origin !== origin || !["GET", "HEAD"].includes(request.method()))
        return route.fulfill({ status: 200, body: "" });
      if (request.url().endsWith("/qa-audio.mp3")) return route.fulfill({ status: 200, body: "" });
      return route.continue();
    });
    await page.addInitScript((fixture) => {
      localStorage.setItem("userAnswers-classic-qa", JSON.stringify(fixture));
      window.__audioPlays = 0;
      HTMLMediaElement.prototype.play = function () {
        window.__audioPlays++;
        return Promise.resolve();
      };
    }, answers);
    await page.goto(origin + "/preview/result.html?series=7&id=classic-qa");
    assert.equal(await page.locator("#result").textContent(), "1/3");
    assert.equal(await page.locator("#serie-num").textContent(), "7");
    assert.equal(await page.locator("#review-prev").isDisabled(), true);
    assert.equal(await page.locator("#btn-explication").isVisible(), false);
    assert.equal(await page.locator(".result-summary").count(), 0);
    assert.equal(await page.locator(".test-container").evaluate((el) => getComputedStyle(el).backgroundColor), "rgb(25, 25, 25)");
    if (width > 768) {
      const media = await page.locator(".test-media").boundingBox();
      const controls = await page.locator(".test-controls").boundingBox();
      assert.ok(media.x + media.width <= controls.x, "Image left; controls right");
    }
    await page.locator("#review-next").click();
    assert.equal(await page.locator("#qustion-num").textContent(), "2");
    assert.equal(await page.locator("#answer-display1").getAttribute("class"), "result-answer-display wrong");
    assert.equal(await page.locator("#answer-display2").textContent(), "1");
    await page.locator("#btn-explication").click();
    assert.equal(await page.evaluate(() => window.__audioPlays), 1);
    await page.locator(".user-wrong-answers button").last().click();
    assert.equal(await page.locator("#qustion-num").textContent(), "3");
    assert.equal(await page.locator("#review-next").isDisabled(), true);
    await page.locator("#review-prev").click();
    assert.equal(await page.locator("#qustion-num").textContent(), "2");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.waitForFunction(() => document.querySelector("#result-media").naturalWidth > 0);
    await page.screenshot({ path: path.join(screenshots, `correction-${width}.png`) });
    await page.goto(origin + "/preview/result.html?examen=true&id=classic-qa");
    assert.equal(await page.locator("#serie-num").textContent(), "Examen");
    await page.goto(origin + "/preview/result.html?series=7&id=missing");
    assert.equal(await page.locator(".no-results").isVisible(), true);
    assert.equal(await page.locator(".comments-panel").isVisible(), false);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS correction ${width}px: layout, navigation, score, audio, exam, empty state`);
  }
  console.log("Screenshots: " + screenshots);
} finally {
  await browser.close();
}

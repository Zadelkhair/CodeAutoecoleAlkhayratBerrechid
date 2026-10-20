import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

// All admin writes are intercepted below. This never edits the real database or publishes.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.QA_CHROMIUM_PATH
    ? { executablePath: process.env.QA_CHROMIUM_PATH }
    : {}),
});
const origin = process.env.QA_ORIGIN || "http://127.0.0.1:5080";
const screenshots = fs.mkdtempSync(
  path.join(os.tmpdir(), "codealkhayrat-design-"),
);
const source = JSON.parse(
  fs.readFileSync(new URL("../db.json", import.meta.url), "utf8"),
);
const image = source.series
  .flatMap((item) => item.questions)
  .find((question) => question.img)?.img;
const fixture = [
  {
    num: 1,
    description: "Série de vérification",
    questions: [1, 2, 3].map((num) => ({
      num,
      img: image,
      audio: "",
      audio_explination: "",
      answer: ["1"],
    })),
  },
];
const reports = [];

async function scenario(
  name,
  width,
  action,
  {
    admin = false,
    empty = false,
    failedSave = false,
    session = false,
    failureLoad = false,
    delayedMedia = false,
  } = {},
) {
  if (process.env.QA_FILTER && !new RegExp(process.env.QA_FILTER).test(name))
    return;
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 1050 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  let releaseMedia;
  const mediaGate = new Promise((resolve) => {
    releaseMedia = resolve;
  });
  let database = empty ? [] : structuredClone(fixture);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      if (
        /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(
          url.host,
        )
      )
        return route.continue();
      return route.fulfill({
        status: 200,
        body: "",
        contentType: "application/javascript",
      });
    }
    if (url.pathname === "/preview/firebase.js")
      return route.fulfill({
        contentType: "application/javascript",
        body: 'window.auth={currentUser:{displayName:"Test"}};window.login=async()=>{};',
      });
    if (session && url.pathname === "/preview/db.js")
      return route.fulfill({
        contentType: "application/javascript",
        body: "let database=" + JSON.stringify({ series: fixture }),
      });
    if (delayedMedia && url.pathname === "/preview/" + image) await mediaGate;
    if (
      admin &&
      (url.pathname === "/series" || url.pathname.startsWith("/series/"))
    ) {
      const method = request.method();
      if (failureLoad && method === "GET")
        return route.fulfill({
          status: 503,
          json: { message: "Serveur indisponible pour le test." },
        });
      if (method !== "GET") writes.push({ path: url.pathname, method });
      if (failedSave && method === "PUT")
        return route.fulfill({
          status: 503,
          json: { message: "Échec simulé. Les données sont conservées." },
        });
      if (method === "POST") database.push(request.postDataJSON());
      if (method === "PUT")
        database[
          database.findIndex(
            (item) => String(item.num) === url.pathname.split("/").pop(),
          )
        ] = request.postDataJSON();
      if (method === "DELETE")
        database = database.filter(
          (item) => String(item.num) !== url.pathname.split("/").pop(),
        );
      return route.fulfill({
        json: method === "GET" ? database : { message: "OK" },
      });
    }
    if (admin && url.pathname === "/question/assets/upload") {
      writes.push({ path: url.pathname, method: request.method() });
      return route.fulfill({
        json: { image, audio: image, audioExplanation: image },
      });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      writes.push({ path: url.pathname, method: request.method() });
      return route.fulfill({
        json: { message: "Simulated only; no publication." },
      });
    }
    return route.continue();
  });
  try {
    await action(page, writes, () => database, { releaseMedia });
    assert.deepEqual(errors, [], "Browser errors");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    );
    assert.equal(overflow, false, "No horizontal page overflow");
    await page.screenshot({
      path: path.join(screenshots, name + ".png"),
      fullPage: true,
    });
    reports.push({ name, ok: true, interceptedWrites: writes.length });
  } catch (error) {
    await page.screenshot({
      path: path.join(screenshots, name + "-failure.png"),
      fullPage: true,
    });
    reports.push({
      name,
      ok: false,
      error: error.message,
      browserErrors: errors,
    });
  } finally {
    releaseMedia();
    await context.close();
  }
}

await scenario("home-desktop", 1440, async (page) => {
  await page.goto(origin + "/preview/");
  await page.locator(".hero-art img").waitFor();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.locator(".cta-btn").click();
  await page.waitForURL("**/series.html");
  assert.equal(
    await page.locator(".series-card").count(),
    source.series.length,
  );
  await page.goto(origin + "/preview/");
  await page.evaluate(() => document.fonts.ready);
});
await scenario("home-mobile", 390, async (page) => {
  await page.goto(origin + "/preview/");
  await page.locator(".hero h1").waitFor();
  await page.locator(".ribbon-close-btn").click();
  assert.equal(await page.locator("#top-ribbon").isVisible(), false);
  assert.equal(
    await page
      .locator("#training-form")
      .evaluate((form) => form.checkValidity()),
    false,
  );
});
await scenario("series-desktop", 1440, async (page) => {
  await page.goto(origin + "/preview/series.html");
  assert.equal(
    await page.locator(".series-card").count(),
    source.series.length,
  );
  await page.locator("#series-search").fill("not-a-series");
  await page.locator(".empty-state").waitFor();
  await page.locator("#series-search").fill("");
  await page.evaluate(() => document.fonts.ready);
});
await scenario("series-mobile", 390, async (page) => {
  await page.goto(origin + "/preview/series.html");
  await page.locator("#series-search").fill(String(source.series[0].num));
  assert.ok((await page.locator(".series-card").count()) > 0);
});
await scenario(
  "admin-desktop",
  1440,
  async (page, writes) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    assert.equal(writes.length, 0, "Loading does not write");
    await page.locator("#questionSearch").fill("2");
    assert.equal(await page.locator(".question-tile").count(), 1);
    await page.locator("#questionSearch").fill("");
    await page.locator('.question-tile[data-num="2"]').click();
    await page.locator("#answer2").check();
    await page.locator("#saveQuestion").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#saveQuestion").classList.contains("loading"),
    );
    await page.locator("#generate-image-btn").click();
    await page.locator("#qImageGenModal.show").waitFor();
    await page.locator("#qImageGenModal .btn-close").click();
    await page.locator("#qImageGenModal").waitFor({ state: "hidden" });
    await page.locator("#publishGithub").click();
    await page.locator("#confirmDialog").waitFor();
    await page.locator('#confirmDialog button[value="cancel"]').click();
    assert.equal(
      writes.filter((item) => item.path === "/push-to-github").length,
      0,
    );
  },
  { admin: true },
);
await scenario(
  "admin-mobile",
  390,
  async (page, writes) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator("#sidebarToggle").click();
    await page.locator('.question-tile[data-num="3"]').click();
    assert.equal(
      await page
        .locator("#sidebar")
        .evaluate((element) => element.classList.contains("open")),
      false,
    );
    await page.locator("#answer2").check();
    await page.locator("#saveQuestion").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#saveQuestion").classList.contains("loading"),
    );
    assert.equal(writes.length, 1);
  },
  { admin: true },
);
await scenario(
  "admin-create-empty",
  1280,
  async (page, writes, getDatabase) => {
    await page.goto(origin + "/");
    await page.locator("#newSeries").click();
    await page.waitForFunction(
      () => document.querySelector("#selectedSerie-num").textContent === "1",
    );
    await page.locator("#newQuestion").click();
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator("#serieDescription").fill("Description de test");
    await page.locator("#answer3").check();
    await page.locator("#saveQuestion").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#saveQuestion").classList.contains("loading"),
    );
    assert.equal(getDatabase()[0].description, "Description de test");
    assert.deepEqual(getDatabase()[0].questions[0].answer, ["3"]);
    assert.equal(writes.length, 3);
  },
  { admin: true, empty: true },
);
await scenario(
  "admin-save-failure",
  1440,
  async (page) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator("#answer2").check();
    await page.locator("#saveQuestion").click();
    await page.locator("#saveStatus.error").waitFor();
    assert.equal(await page.locator("#answer2").isChecked(), true);
    assert.equal(await page.locator("#saveQuestion").isEnabled(), true);
  },
  { admin: true, failedSave: true },
);
await scenario(
  "admin-load-failure",
  390,
  async (page) => {
    await page.goto(origin + "/");
    await page.locator("#studioToast.error").waitFor();
    assert.equal(await page.locator("#saveQuestion").isDisabled(), true);
  },
  { admin: true, failureLoad: true },
);
await scenario(
  "test-loader-ready",
  1440,
  async (page) => {
    await page.goto(origin + "/preview/test.html?series=1&index=0");
    await page.waitForFunction(
      () => document.querySelector("#progress").textContent === "100%",
    );
    assert.equal(await page.locator("#start-label").textContent(), "Commencer");
    assert.equal(await page.locator("#start-btn").isEnabled(), true);
    assert.equal(await page.locator(".test-container").isVisible(), false);
    const position = await page.locator("#start-btn").boundingBox();
    assert.ok(Math.abs(position.x + position.width / 2 - 720) < 2);
    assert.ok(Math.abs(position.y + position.height / 2 - 525) < 2);
  },
  { session: true },
);
await scenario(
  "test-loader-pending",
  1440,
  async (page, writes, database, { releaseMedia }) => {
    await page.goto(origin + "/preview/test.html?series=1&index=0", {
      waitUntil: "domcontentloaded",
    });
    assert.equal(await page.locator("#start-btn").isDisabled(), true);
    assert.equal(await page.locator("#progress").textContent(), "0%");
    assert.equal(
      await page.locator("#start-label").textContent(),
      "Chargement…",
    );
    assert.equal(await page.locator(".test-container").isVisible(), false);
    releaseMedia();
    await page.waitForFunction(
      () => document.querySelector("#progress").textContent === "100%",
    );
    assert.equal(await page.locator("#start-btn").isEnabled(), true);
  },
  { session: true, delayedMedia: true },
);
for (const width of [1440, 390, 320, 768])
  await scenario(
    "test-active-" + width,
    width,
    async (page) => {
      await page.goto(origin + "/preview/test.html?series=1&index=0");
      await page.locator("#start-btn").click();
      await page.waitForFunction(
        () => document.fullscreenElement === document.documentElement,
      );
      await page.waitForFunction(
        () => document.querySelector("#qustion-num").textContent === "1",
      );
      await page.locator("#btn1").click();
      assert.equal(
        await page.locator("#btn1").getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".btn-correction").click();
      assert.equal(
        await page.locator("#btn1").getAttribute("aria-pressed"),
        "false",
      );
      const controls = await page
        .locator(".test-controls")
        .evaluate((element) =>
          [...element.querySelectorAll("button")]
            .filter((button) => button.offsetParent !== null)
            .map((button) => button.textContent.trim()),
        );
      assert.deepEqual(controls, ["Correction", "1", "2", "3", "4", "Valider"]);
      if (width > 768) {
        const imageBox = await page.locator(".test-media").boundingBox();
        const controlsBox = await page.locator(".test-controls").boundingBox();
        assert.ok(
          imageBox.x + imageBox.width <= controlsBox.x,
          "Image stays on the left of the controls",
        );
        const positions = await page
          .locator("#test-answers")
          .evaluate((element) =>
            [...element.children].map(
              (button) => button.getBoundingClientRect().y,
            ),
          );
        assert.ok(
          positions.every(
            (y, index) => index === 0 || y > positions[index - 1],
          ),
          "Answers stay vertical",
        );
      }
      await page.locator("#pause-btn").click();
      await page.locator("#pause-screen").waitFor();
      await page.locator("#pause-screen button").first().click();
      await page.locator("#pause-screen").waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => document.fullscreenElement === document.documentElement,
      );
      await page.waitForTimeout(550);
      await page.locator(".btn-valider").click();
      await page.waitForFunction(
        () => document.querySelector("#qustion-num").textContent === "2",
      );
      await page.waitForFunction(
        () => document.querySelector("#test-media").naturalWidth > 0,
      );
      await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
    },
    { session: true },
  );
await scenario(
  "test-fullscreen-unavailable",
  1440,
  async (page) => {
    await page.addInitScript(() => {
      window.__fullscreenRequests = 0;
      Element.prototype.requestFullscreen = function () {
        window.__fullscreenRequests++;
        return Promise.reject(new Error("Fullscreen denied for the test"));
      };
    });
    await page.goto(origin + "/preview/test.html?series=1&index=0");
    await page.locator("#start-btn").click();
    await page.waitForFunction(
      () => document.querySelector("#qustion-num").textContent === "1",
    );
    assert.equal(await page.evaluate(() => window.__fullscreenRequests), 1);
    assert.equal(await page.locator(".test-container").isVisible(), true);
    const box = await page.locator(".test-container").boundingBox();
    assert.ok(
      Math.abs(box.width - 1440) < 2 && Math.abs(box.height - 1050) < 2,
      "Full-window fallback remains usable",
    );
  },
  { session: true },
);
for (const width of [1440, 390])
  await scenario("results-" + width, width, async (page) => {
    await page.goto(origin + "/preview/");
    await page.evaluate(
      (questions) =>
        localStorage.setItem(
          "userAnswers-qa",
          JSON.stringify(
            questions.map((question, index) => ({
              question,
              userAnswer: [index ? "2" : "1"],
              isCorrect: !index,
            })),
          ),
        ),
      fixture[0].questions,
    );
    await page.goto(origin + "/preview/result.html?series=1&id=qa");
    assert.equal(await page.locator("#result").textContent(), "1/3");
    await page.locator("#review-next").click();
    assert.equal(await page.locator("#qustion-num").textContent(), "2");
    await page.locator(".user-wrong-answers button").last().click();
    assert.equal(await page.locator("#qustion-num").textContent(), "3");
  });
await scenario("results-empty", 390, async (page) => {
  await page.goto(origin + "/preview/result.html?series=1&id=missing");
  await page.locator(".no-results").waitFor();
});
await scenario(
  "admin-unsaved-navigation",
  1280,
  async (page, writes, getDatabase) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator("#answer2").check();
    await page.locator("#next-question-btn").click();
    await page.locator("#confirmDialog").waitFor();
    await page.locator('#confirmDialog button[value="cancel"]').click();
    assert.equal(
      await page.locator("#selectedQuestion-num").textContent(),
      "1",
    );
    assert.equal(writes.length, 0);
    await page.locator("#next-question-btn").click();
    await page.locator("#confirmAction").click();
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "2",
    );
    assert.deepEqual(getDatabase()[0].questions[0].answer, ["1", "2"]);
  },
  { admin: true },
);
await scenario(
  "admin-delete-confirmation",
  1280,
  async (page, writes, getDatabase) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator(".danger-zone summary").click();
    await page.locator("#deleteQuestion").click();
    await page.locator('#confirmDialog button[value="cancel"]').click();
    assert.equal(writes.length, 0);
    await page.locator("#deleteQuestion").click();
    await page.locator("#confirmAction").click();
    await page.waitForFunction(
      () => document.querySelector("#questionCount").textContent === "2",
    );
    assert.equal(getDatabase()[0].questions.length, 2);
  },
  { admin: true },
);
await scenario(
  "admin-image-import",
  1440,
  async (page, writes, getDatabase) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page
      .locator("#imageFile")
      .setInputFiles(new URL("../docs/" + image, import.meta.url).pathname);
    await page.locator("#saveQuestion").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#saveQuestion").classList.contains("loading"),
    );
    assert.equal(
      writes.filter((item) => item.path === "/question/assets/upload").length,
      1,
    );
    assert.equal(getDatabase()[0].questions[0].img, image);
  },
  { admin: true },
);
await scenario(
  "admin-bulk-import",
  1280,
  async (page, writes, getDatabase) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator(".bulk-section summary").click();
    await page
      .locator("#bulk-image-input")
      .setInputFiles(new URL("../docs/" + image, import.meta.url).pathname);
    await page.locator("#bulk-image-submit").click();
    await page.waitForFunction(
      () => document.querySelector("#questionCount").textContent === "4",
    );
    assert.equal(getDatabase()[0].questions.length, 4);
    assert.equal(
      writes.filter((item) => item.path === "/question/assets/upload").length,
      1,
    );
  },
  { admin: true },
);
await scenario(
  "admin-image-generator",
  1440,
  async (page) => {
    await page.goto(origin + "/");
    await page.waitForFunction(
      () => document.querySelector("#selectedQuestion-num").textContent === "1",
    );
    await page.locator("#generate-image-btn").click();
    await page
      .locator("#qImageInput")
      .setInputFiles(new URL("../docs/" + image, import.meta.url).pathname);
    await page.waitForFunction(() =>
      document.querySelector("#qImagePreview").src.startsWith("data:"),
    );
    await page.locator("#qImageGenBtn").click();
    await page.locator("#qImageGenSelectBtn").waitFor();
    await page.locator("#qImageGenSelectBtn").click();
    await page.locator("#qImageGenModal").waitFor({ state: "hidden" });
    assert.equal(
      await page
        .locator("#s-image")
        .evaluate((element) => element.src.startsWith("data:image/png")),
      true,
    );
    assert.equal(
      await page
        .locator("#saveStatus")
        .evaluate((element) => element.classList.contains("dirty")),
      true,
    );
  },
  { admin: true },
);
for (const width of [320, 768, 1024]) {
  for (const [name, route, admin] of [
    ["home", "/preview/", false],
    ["series", "/preview/series.html", false],
    ["admin", "/", true],
  ]) {
    await scenario(
      "responsive-" + name + "-" + width,
      width,
      async (page) => {
        await page.goto(origin + route);
        if (admin)
          await page.waitForFunction(
            () =>
              document.querySelector("#selectedQuestion-num").textContent ===
              "1",
          );
        else await page.getByRole("heading", { level: 1 }).waitFor();
      },
      { admin },
    );
  }
}
await browser.close();
console.log(JSON.stringify({ screenshots, reports }, null, 2));
if (reports.some((report) => !report.ok)) process.exitCode = 1;

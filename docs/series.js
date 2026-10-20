const series = database.series;
const elemSeries = document.querySelector("#series");
const count = document.querySelector("#library-count");

function renderSeries(query = "") {
  elemSeries.replaceChildren();
  const search = query
    .trim()
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const matches = series
    .map((serie, index) => ({ serie, index }))
    .filter(({ serie }) =>
      `${serie.num} ${serie.description || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  count.textContent = `${matches.length} سلسلة متاحة للتدرّب`;
  for (const { serie, index } of matches) {
    const button = document.createElement("button");
    button.className = "series-card";
    button.dataset.num = serie.num;
    button.dataset.index = index;
    button.innerHTML =
      '<div class="series-card-top"><span class="series-number"></span><span class="series-type">تدرّب · راجع · تقدّم</span></div><div><h2></h2><p></p></div><div class="series-card-bottom"><span class="question-count"></span><strong class="series-start">ابدأ السلسلة <span aria-hidden="true">←</span></strong></div>';
    button.querySelector(".series-number").textContent = String(
      serie.num,
    ).padStart(2, "0");
    button.querySelector("h2").textContent = `السلسلة ${serie.num}`;
    button.querySelector("p").textContent =
      serie.description || "أسئلة مصوّرة للتدرّب على قانون السير";
    button.querySelector(".question-count").textContent =
      `${serie.questions.length} سؤالًا`;
    button.disabled = !serie.questions.length;
    button.addEventListener("click", () => {
      window.location.href = `test.html?series=${encodeURIComponent(serie.num)}&index=${index}`;
    });
    elemSeries.appendChild(button);
  }
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "لا توجد سلسلة بهذا الرقم. جرّب بحثًا آخر.";
    elemSeries.appendChild(empty);
  }
}
document
  .querySelector("#series-search")
  .addEventListener("input", (event) => renderSeries(event.target.value));
renderSeries();

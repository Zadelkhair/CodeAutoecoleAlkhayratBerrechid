// import ./db.json

console.log(database);


// get series
const series = database.series;

// 
let elemSeries = document.querySelector("#series");


for (let i = 0; i < series.length; i++) {
    console.log(series[i].num);

    // create btn
    let btn = document.createElement("button");
    btn.classList.add("s-btn");
    btn.innerHTML = series[i].num;
    btn.setAttribute("data-index", i);
    btn.setAttribute("data-num", series[i].num);
    btn.addEventListener("click", function (e) {
        // redirect to test.html with param series num and index
        window.location.href = `test.html?series=${series[i].num}&index=${i}`;
    });

    // append to elemSeries
    elemSeries.appendChild(btn);

}
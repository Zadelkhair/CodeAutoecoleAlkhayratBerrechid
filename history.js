// get test-body
let testBody = document.querySelector(".test-body");

// get history local storage
let history = JSON.parse(localStorage.getItem("history")) ?? [];

console.log(history);

let innerHTML = (date, result, serie) => {
return `<div class="history-item">
    <div class="history-serie">${serie}</div>
    <div class="history-result">${result}</div>
    <div class="history-date">${date}</div>
</div>`;
}

// loop through history and create a button for each history
for (let i = history.length - 1; i >= 0; i--) {
    let btn = document.createElement("button");
    // add class    
    btn.classList.add("btn-history")

    btn.innerHTML = innerHTML(history[i].date, `${history[i].result}/${history[i].total}`, history[i].series);

    btn.addEventListener("click",(e)=>{

        let examen = history[i].series == "examen";
        let ID = history[i].id;
        let seriesNum = history[i].series;
        let index = history[i].index;

        console.log(history[i]);

        if(examen){
            window.location.href = `result.html?examen=true&id=${ID}`;
        }
        else {
            window.location.href = `result.html?series=${seriesNum}&index=${index}&id=${ID}`;
        }

    });

    testBody.appendChild(btn);
}
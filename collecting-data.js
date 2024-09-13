// get #collecting-data
let cde = document.querySelector("#collecting-data");
// set display to block
cde.style.display = "flex"

// get current serie data from local storage
let serieToCollect = JSON.parse(localStorage.getItem("serie-"+seriesNum));

// if serie is null
if (serieToCollect === null) {
    serieToCollect = database.series[index];
    // save 
    localStorage.setItem("serie-"+seriesNum, JSON.stringify(serieToCollect));
}

// watch checkbox
let checkboxes = document.querySelectorAll("#collecting-data input[type='checkbox']");
let checked = [];

checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            checked.push(e.target.value);
        }
        else {
            checked = checked.filter((check) => check != e.target.value);
        }
        saveChanged(checked, currentQuestion);
    });
});

const saveChanged = (answer,answerIndex) => {
    serieToCollect.questions[answerIndex].answer = answer;
    // save to local storage
    localStorage.setItem(`serie-${seriesNum}`, JSON.stringify(serieToCollect));
}

const loadAnswerToCheckbox = (answer) => {
    checkboxes.forEach((checkbox) => {
        if (answer.includes(checkbox.value)) {
            checkbox.checked = true;
        }
        else {
            checkbox.checked = false;
        }
    });
}   

const goTo = (answerNum) => {

    if (answerNum >= serieToCollect.questions.length) {
        return;
    }
    
    let question = serieToCollect.questions[answerNum];

    loadAnswerToCheckbox(question.answer);

    // set image
    imgTestElement.src = question.img;

    // set question number
    qustionNumElement.innerHTML = answerNum + 1;

    checked = [];

}

const next = () => {
    if (currentQuestion+1 >= serieToCollect.questions.length) {
        return;
    }
    currentQuestion++;
    goTo(currentQuestion);
}

const prev = () => {
    if (currentQuestion-1 < 0) {
        return;
    }
    currentQuestion--;
    goTo(currentQuestion);
}

const startCollectMode = () => {
    testContainer.style.display = "flex";
    // hide start-btn
    startBtn.style.display = "none";
    next();
}

startCollectMode();


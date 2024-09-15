// 
let imgTestElement = document.querySelector("#result-media");
let serieNumElement = document.querySelector("#serie-num");
let qustionNumElement = document.querySelector("#qustion-num");
let resultElement = document.querySelector("#result");
let answerDisplayElement1 = document.querySelector("#answer-display1");
let answerDisplayElement2 = document.querySelector("#answer-display2");

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let id = urlParams.get("id");
let seriesNum = urlParams.get("series");
let examen = urlParams.get("examen");

if ((id === null || seriesNum === null) && (examen === null || id === null )) {
    window.location.href = "index.html";
}

// set serie num
if (examen !== null) {
    serieNumElement.innerHTML = "Examen";
}
else {
    serieNumElement.innerHTML = seriesNum;
}

// get local storage user answers
let userAnswers = JSON.parse(localStorage.getItem("userAnswers-" + id));

// set result
let correctAnswers = userAnswers.filter((answer) => answer.isCorrect).length;
let totalAnswers = userAnswers.length;
resultElement.innerHTML = `${correctAnswers}/${totalAnswers}`;

// if more than 32
if (correctAnswers > 32) {
    // set background to green
    resultElement.style.backgroundColor = "green";
    resultElement.style.color = "white";
}
else {
    // set background to red
    resultElement.style.backgroundColor = "red";
    resultElement.style.color = "white";
}

// loop through user answers and set the wrong answers to #user-wrong-answers
let wrongAnswers = userAnswers.filter((answer) => !answer.isCorrect);
let userWrongAnswersElement = document.querySelector("#user-wrong-answers");
for (let i = 0; i < wrongAnswers.length; i++) {
    let btn = document.createElement("button");
    btn.innerHTML = wrongAnswers[i].question.num;
    btn.setAttribute("data-index", i);
    btn.addEventListener("click", function (e) {
        let index = e.target.getAttribute("data-index");
        goTo(userAnswers.indexOf(wrongAnswers[index]));
    });

    userWrongAnswersElement.appendChild(btn);
}


console.log(userAnswers);

let currentAnswers = -1;

const goTo = (answerNum) => {

    if (answerNum >= userAnswers.length) {
        return;
    }

    let userAnswer = userAnswers[answerNum].userAnswer;
    let isCorrect = userAnswers[answerNum].isCorrect;
    let question = userAnswers[answerNum].question;

    // clear displays
    answerDisplayElement1.innerHTML = "";
    answerDisplayElement2.innerHTML = "";

    // set user answer
    answerDisplayElement1.innerHTML = userAnswer.join(" ");

    // remove .correct and .wrong
    answerDisplayElement1.classList.remove("correct");
    answerDisplayElement1.classList.remove("wrong");

    // set correct answer
    answerDisplayElement2.innerHTML = question.answer.join(" ");

    // add .correct or .wrong
    if (isCorrect) {
        answerDisplayElement1.classList.add("correct");
    } else {
        answerDisplayElement1.classList.add("wrong");
    }

    // set image
    imgTestElement.src = question.img;

    // set question number
    qustionNumElement.innerHTML = answerNum + 1;

}

next = () => {
    if (currentAnswers+1 >= userAnswers.length) {
        return;
    }
    currentAnswers++;
    goTo(currentAnswers);
}

prev = () => {
    if (currentAnswers-1 < 0) {
        return;
    }
    currentAnswers--;
    goTo(currentAnswers);
}

next();

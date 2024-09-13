// generate random number
let ID = Math.floor(Math.random() * 1000000);

// 
let imgTestElement = document.querySelector("#test-media");
let serieNumElement = document.querySelector("#serie-num");
let qustionNumElement = document.querySelector("#qustion-num");
let timerElement = document.querySelector("#timer");
let answerDisplayElement = document.querySelector("#answer-display");
let answerButtons = document.querySelectorAll("#test-answers > button");    

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let seriesNum = urlParams.get("series");
let index = urlParams.get("index");

if (seriesNum === null || index === null) {
    window.location.href = "series.html";
}

// if length of series is less than index
if (database.series.length <= index) {
    window.location.href = "series.html";
}

let serie = database.series[index];
serieNumElement.innerHTML = seriesNum;

if (serie === undefined) {
    window.location.href = "series.html";
}

let currentQuestion = -1;
let currentAnswer = [];

let userAnswers = []; // {question: 0, answer: ["1", "2", "3"]}

let maxTime = 30;
let timer = maxTime;

let timerInterval;

let startTimer = () => {
    timerElement.innerHTML = timer;
    timerInterval = setInterval(() => {
        timer--;
        timerElement.innerHTML = timer>9?timer:`0${timer}`;
        if (timer <= 0) {
            validate();
            clearInterval(timerInterval);
        }
    }, 1000);
}

let resetTimer = () => {
    timerElement.innerHTML = '--';
    clearInterval(timerInterval);
    timer = maxTime;
}

let validate = () => {

    let question = serie.questions[currentQuestion];
    let correct = question.answer;

    let isCorrect = true;
    if (currentAnswer.length !== correct.length) {
        isCorrect = false;
    } else {
        for (let i = 0; i < correct.length; i++) {
            if (!currentAnswer.includes(correct[i])) {
                isCorrect = false;
                break;
            }
        }
    }

    userAnswers.push({
        question: serie.questions[currentQuestion],
        userAnswer: currentAnswer,
        isCorrect
    });

    // save to local storage
    localStorage.setItem(`userAnswers-${ID}`, JSON.stringify(userAnswers));

    nextQuestion();
}

const currentImg = new Image();
const currentAudio = new Audio();

const checkAnswer = (answer,btnid) => {

    // if answer is already selected then remove it
    if (currentAnswer.includes(answer)) {
        currentAnswer = currentAnswer.filter((ans) => ans !== answer);
        document.getElementById(btnid).classList.remove("selected");
    } else {
        currentAnswer.push(answer);
        document.getElementById(btnid).classList.add("selected");
    }

    answerDisplayElement.innerHTML = currentAnswer.join(" ");
}

const clearAnswer = () => {
    currentAnswer = [];
    answerDisplayElement.innerHTML = "";
    answerButtons.forEach((btn) => {
        btn.classList.remove("selected");
    });
}

let nextQuestion = () => {
    currentQuestion++;
    if (currentQuestion >= serie.questions.length) {
        // end of questions
        clearInterval(timerInterval);
        // redirect to result page
        window.location.href = `result.html?series=${seriesNum}&index=${index}&id=${ID}`;
        return;
    }

    resetTimer();
    clearAnswer();

    let question = serie.questions[currentQuestion];
    qustionNumElement.innerHTML = currentQuestion + 1;
    
    // load image
    currentImg.src = question.img;
    currentImg.onload = () => {

        imgTestElement.src = currentImg.src;

        // load audio and play it
        currentAudio.src = question.audio;
        currentAudio.play();

        // wait for audio to finish
        currentAudio.onended = () => {
            startTimer();
        }

    }

}

// nextQuestion();

// get test-container
let testContainer = document.querySelector(".test-container");

// hide it
testContainer.style.display = "none";

// get start-btn
let startBtn = document.querySelector("#start-btn");

// add event listener
startBtn.addEventListener("click", () => {
    // show test-container
    testContainer.style.display = "flex";
    // hide start-btn
    startBtn.style.display = "none";
    // start test
    nextQuestion();
});

let isPaused = false;
const pause = () => {
    clearInterval(timerInterval);
    currentAudio.pause();
    isPaused = true;
}

const resume = () => {
    startTimer();
    isPaused = false;
}

const pauseResume = () => {
    if (isPaused) {
        resume();
    } else {
        pause();
    }
}

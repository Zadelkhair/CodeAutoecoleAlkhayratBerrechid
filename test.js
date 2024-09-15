
// generate random number
let ID = Math.floor(Math.random() * 1000000);

// 
let imgTestElement = document.querySelector("#test-media");
let serieNumElement = document.querySelector("#serie-num");
let qustionNumElement = document.querySelector("#qustion-num");
let timerElement = document.querySelector("#timer");
let answerDisplayElement = document.querySelector("#answer-display");
let answerButtons = document.querySelectorAll("#test-answers > button");    
let pauseBtn = document.querySelector("#pause-btn");

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let seriesNum = urlParams.get("series");
let index = urlParams.get("index");
let examen = urlParams.get("examen");

let history = JSON.parse(localStorage.getItem("history"))??[];

if ((seriesNum === null || index === null) && examen === null) {
    window.location.href = "series.html";
}

// if length of series is less than index
if (database.series.length <= index && examen === null) {
    window.location.href = "series.html";
}

let serie = null;

if(examen !== null){
    // serie = database.examen[examen];

    // randomize 40 questions from all series without repetition
    let questions = [];
    let allQuestions = [];
    database.series.forEach((serie) => {
        allQuestions = allQuestions.concat(serie.questions);
    });

    while (questions.length < 40) {
        let randomIndex = Math.floor(Math.random() * allQuestions.length);
        if (!questions.includes(allQuestions[randomIndex])) {
            questions.push(allQuestions[randomIndex]);
        }
    }

    // update serie numbers 
    questions.forEach((question, index) => {
        question.num = index + 1;
    });

    serie = {
        questions
    };

    serieNumElement.innerHTML = "Examen";
}
else {
    serie = database.series[index];
    serieNumElement.innerHTML = seriesNum;
}


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

    // check if userAnswers-<ID> is in history
    let historyIndex = history.findIndex((item) => item.id === ID);
    if (historyIndex === -1) {
        history.push({
            id: ID, 
            series: examen !== null ? "examen" : seriesNum,
            index: index,
            result: userAnswers.filter((answer) => answer.isCorrect).length,
            total: userAnswers.length,
            date: new Date().toLocaleString(),
            userAnswers
        });
        localStorage.setItem("history", JSON.stringify(history));
    } else {
        history[historyIndex] = {
            id: ID, 
            series: examen !== null ? "examen" : seriesNum,
            index: index,
            result: userAnswers.filter((answer) => answer.isCorrect).length,
            total: userAnswers.length,
            date: new Date().toLocaleString(),
            userAnswers,
        };
        localStorage.setItem("history", JSON.stringify(history));
    }

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
        if(examen !== null){
            window.location.href = `result.html?examen=true&id=${ID}`;
        }
        else {
            window.location.href = `result.html?series=${seriesNum}&index=${index}&id=${ID}`;
        }

        fullscreen(false);
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


let isPaused = false;
const pause = () => {
    clearInterval(timerInterval);
    currentAudio.pause();
    isPaused = true;
    pauseBtn.innerHTML = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAwUlEQVR4nO3WMWoCQBCF4Q8CwTSms7XQPhfICWxyi1zBNqVX8Aq2llYhhNSCN7BU0ohNIBmbXUiZQmeV+OCvf1hmZx7XNM47lnjKFscvPvDYQhyFOYYtxIEvTNHLFkdhhxfcZYujsMYzbrLFUVhh1EIchQUeWogD35ihny2Owh4T3GeLK1uMcZstrrz+G/Em+6nrcHX/IrzY77TIXiCr7JW5zj4Sn2VSO8cS1pxNEfgpkzo4lbCmWdl7a1Vvr3HsHACr5CJWnhywpwAAAABJRU5ErkJggg==">`;
    fullscreen(false);
}

const resume = () => {
    startTimer();
    isPaused = false;
    pauseBtn.innerHTML = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAX0lEQVR4nO2WQQqAQAwD53ku/v8D1n9EBAUpFDwURM1AbiELpQ0L5s/MwAroUACj0V8Sl5BTS6O/RIW6/CV+WB51wssln9NdXCBygSRcIHpdgcRTX5+RwvaQqdFvPs4Gyhr/h1qOuFIAAAAASUVORK5CYII=">`;
    fullscreen();
}

const pauseResume = () => {
    if (isPaused) {
        resume();
    } else {
        pause();
    }
}

// ask user for fullscreen
let fullscreen = (open = true) => {
    if (document.fullscreenElement === null && open) {
        document.documentElement.requestFullscreen();
    }
    
    if (!open) {
        document.exitFullscreen();
    }
}

// get start-btn
let startBtn = document.querySelector("#start-btn");

// add event listener
startBtn.addEventListener("click", () => {
    // ask for fullscreen
    fullscreen();

    // show test-container
    testContainer.style.display = "flex";
    // hide start-btn
    startBtn.style.display = "none";
    // start test
    nextQuestion();
});

// all media and load them (images and audios)
const assetsLoader = (callback,progress) => {

    // get all images
    let images = [];

    // get all audios
    let audios = [];

    serie.questions.forEach((question) => {
        if (question.img !== "") {
            images.push(question.img);
        }
        if (question.audio !== "") {
            audios.push(question.audio);
        }
    });

    let total = images.length + audios.length;

    let loaded = 0;

    let check = () => {
        loaded++;
        progress(loaded,total);
        if (loaded >= total) {
            callback();
        }
    }

    images.forEach((img) => {
        let image = new Image();
        image.src = img;
        image.onload = check;
    });

    audios.forEach((audio) => {
        let audioElement = new Audio();
        audioElement.src = audio;
        audioElement.onloadeddata = check;
    });

}

// get #progress-bar and ##progress
let progressBarElement = document.querySelector("#progress-bar");
let progressValElement = document.querySelector("#progress");
assetsLoader(()=>{
    console.log("All assets loaded");
},(loaded,total)=>{
    console.log(`${loaded}/${total}`);
    let percent = parseInt((loaded/total)*100);
    progressBarElement.style.width = `${percent}%`;
    progressValElement.innerHTML = `${percent}%`;
});
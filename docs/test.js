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
let pauseScreen = document.querySelector("#pause-screen");

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let seriesNum = urlParams.get("series");
let index = urlParams.get("index");
let examen = urlParams.get("examen");

if ((seriesNum === null || index === null) && examen === null) {
  window.location.href = "series.html";
}

// if length of series is less than index
if (database.series.length <= index && examen === null) {
  window.location.href = "series.html";
}

let serie = null;

if (examen !== null) {
  // serie = database.examen[examen];

  // randomize 40 questions from all series without repetition
  let questions = [];
  let allQuestions = [];
  database.series.forEach((serie) => {
    allQuestions = allQuestions.concat(serie.questions);
  });

  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }
  questions = allQuestions.slice(0, 40).map((question) => ({ ...question }));

  // update serie numbers
  questions.forEach((question, index) => {
    question.num = index + 1;
  });

  serie = {
    questions,
  };

  serieNumElement.innerHTML = "Examen";
} else {
  serie = database.series[index];
  serieNumElement.innerHTML = seriesNum;
}

if (serie === undefined) {
  window.location.href = "series.html";
  serie = { questions: [] };
}

const hasQuestions = Boolean(serie?.questions.length);
document.querySelector("#question-total").textContent =
  " / " + (serie?.questions.length || 0);
if (!hasQuestions) {
  document.querySelector("#start-btn").disabled = true;
  document.querySelector("#start-label").textContent = "Aucune question";
}

let currentQuestion = -1;
let currentAnswer = [];

let userAnswers = []; // {question: 0, answer: ["1", "2", "3"]}

let maxTime = 30;
let timer = maxTime;

let timerInterval;

let startTimer = () => {
  clearInterval(timerInterval);
  timerElement.innerHTML = timer;
  timerInterval = setInterval(() => {
    timer--;
    timerElement.innerHTML = timer > 9 ? timer : `0${timer}`;
    if (timer <= 0) {
      clearInterval(timerInterval);
      validate();
    }
  }, 1000);
};

let resetTimer = () => {
  timerElement.innerHTML = "--";
  clearInterval(timerInterval);
  timer = maxTime;
};

// last time clicked on validate button (default current datetime)
let lastValidateTime = new Date();

let validate = () => {
  if (
    isPaused ||
    currentQuestion < 0 ||
    currentQuestion >= serie.questions.length
  )
    return;

  // check if the user clicked validate within 2 seconds
  let currentTime = new Date();
  if (currentTime - lastValidateTime < 500) {
    console.warn("You clicked validate too fast. Please wait a moment.");
    return;
  }
  lastValidateTime = currentTime; // update last validate time

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
    isCorrect,
  });

  // save to local storage
  localStorage.setItem(`userAnswers-${ID}`, JSON.stringify(userAnswers));

  nextQuestion();
};

const currentAudio = new Audio();
let waitingForAudio = false;

const checkAnswer = (answer, btnid) => {
  // if answer is already selected then remove it
  if (currentAnswer.includes(answer)) {
    currentAnswer = currentAnswer.filter((ans) => ans !== answer);
    document.getElementById(btnid).classList.remove("selected");
    document.getElementById(btnid).setAttribute("aria-pressed", "false");
  } else {
    currentAnswer.push(answer);
    document.getElementById(btnid).classList.add("selected");
    document.getElementById(btnid).setAttribute("aria-pressed", "true");
  }

  answerDisplayElement.innerHTML = currentAnswer.join(" ");
};

const clearAnswer = () => {
  currentAnswer = [];
  answerDisplayElement.innerHTML = "";
  answerButtons.forEach((btn) => {
    btn.classList.remove("selected");
    btn.setAttribute("aria-pressed", "false");
  });
};

const endSerie = () => {
  clearInterval(timerInterval);
  fullscreen(false);
  if (examen !== null) {
    window.location.href = `result.html?examen=true&id=${ID}`;
  } else {
    window.location.href = `result.html?series=${seriesNum}&index=${index}&id=${ID}`;
  }
};

let nextQuestion = () => {
  currentAudio.pause();
  currentAudio.onended = currentAudio.onerror = null;
  currentQuestion++;
  if (currentQuestion >= serie.questions.length) {
    endSerie();
    return;
  }

  resetTimer();
  clearAnswer();

  let question = serie.questions[currentQuestion];
  qustionNumElement.innerHTML = currentQuestion + 1;

  // load image
  waitingForAudio = Boolean(question.audio);
  imgTestElement.src = question.img || "";
  if (!question.audio) {
    currentAudio.removeAttribute("src");
    startTimer();
    return;
  }
  currentAudio.onended = currentAudio.onerror = () => {
    waitingForAudio = false;
    if (!isPaused) startTimer();
  };
  currentAudio.src = question.audio;
  currentAudio.play().catch(() => {
    waitingForAudio = false;
    if (!isPaused) startTimer();
  });
};

// nextQuestion();

// get test-container
let testContainer = document.querySelector(".test-container");

testContainer.hidden = true;

let isPaused = false;
const pause = () => {
  testContainer.inert = true;
  clearInterval(timerInterval);
  currentAudio.pause();
  isPaused = true;
  pauseBtn.textContent = "▶";
  pauseBtn.setAttribute("aria-label", "Reprendre le test");
  fullscreen(false);
  // show pauseScreen
  pauseScreen.style.display = "flex";
  // get #pause-serie-info
  let pauseSerieInfo = document.querySelector("#pause-serie-info");
  pauseSerieInfo.textContent =
    "Question " + (currentQuestion + 1) + " sur " + serie.questions.length;
  pauseScreen.querySelector("button").focus();
};

const resume = () => {
  testContainer.inert = false;
  isPaused = false;
  if (waitingForAudio)
    currentAudio.play().catch(() => {
      waitingForAudio = false;
      startTimer();
    });
  else startTimer();
  pauseBtn.textContent = "Ⅱ";
  pauseBtn.setAttribute("aria-label", "Mettre en pause");
  fullscreen();
  // show pauseScreen
  pauseScreen.style.display = "none";
};

const pauseResume = () => {
  if (isPaused) {
    resume();
  } else {
    pause();
  }
};

// Request fullscreen directly from the click, preserving browser user activation.
let fullscreen = (open = true) => {
  const root = document.documentElement;
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  const request =
    root.requestFullscreen ||
    root.webkitRequestFullscreen ||
    root.mozRequestFullScreen ||
    root.msRequestFullscreen;
  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;
  try {
    if (open && !active && request)
      return Promise.resolve(request.call(root)).then(
        () => true,
        () => false,
      );
    if (!open && active && exit)
      return Promise.resolve(exit.call(document)).then(
        () => true,
        () => false,
      );
  } catch {
    // Unsupported/restricted browsers still get the full-window test layout.
  }
  return Promise.resolve(false);
};

const assetsLoader = (complete, progress) => {
  const images = [
    ...new Set(serie.questions.map((question) => question.img).filter(Boolean)),
  ];
  const audios = [
    ...new Set(
      serie.questions.map((question) => question.audio).filter(Boolean),
    ),
  ];
  const total = images.length + audios.length;
  let loaded = 0;
  let failed = 0;
  if (!total) {
    progress(1, 1);
    complete(0);
    return;
  }
  const pending = new Set();
  const load = (url, audio) => {
    const media = audio ? new Audio() : new Image();
    pending.add(media);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      media.onload =
        media.onerror =
        media.onloadeddata =
        media.oncanplay =
          null;
      pending.delete(media);
      loaded++;
      if (error) failed++;
      progress(loaded, total);
      if (loaded === total) complete(failed);
    };
    const timeout = setTimeout(() => finish(true), 20000);
    media.onerror = () => finish(true);
    if (audio) {
      media.preload = "auto";
      media.onloadeddata = media.oncanplay = () => finish(false);
    } else media.onload = () => finish(false);
    media.src = url;
  };
  images.forEach((url) => load(url, false));
  audios.forEach((url) => load(url, true));
};

const startBtn = document.querySelector("#start-btn");
const startLabel = document.querySelector("#start-label");
const progressBarElement = document.querySelector("#progress-bar");
const progressValElement = document.querySelector("#progress");
let assetsReady = false;

startBtn.addEventListener("click", () => {
  if (!assetsReady || !hasQuestions) return;
  fullscreen();
  document.querySelector("#test-intro").hidden = true;
  document.body.classList.add("test-started");
  testContainer.hidden = false;
  nextQuestion();
});

assetsLoader(
  (failed) => {
    assetsReady = true;
    startBtn.disabled = !hasQuestions;
    startBtn.setAttribute("aria-busy", "false");
    startLabel.textContent = hasQuestions ? "Commencer" : "Aucune question";
    if (failed) {
      const message = document.querySelector("#loader-message");
      message.textContent =
        failed +
        " média(s) indisponible(s). Vous pouvez continuer ou recharger la page pour réessayer.";
      message.hidden = false;
    }
  },
  (loaded, total) => {
    const percent = Math.floor((loaded / total) * 100);
    progressBarElement.style.width = percent + "%";
    progressValElement.textContent = percent + "%";
    document
      .querySelector("#media-loader")
      .setAttribute("aria-valuenow", String(percent));
  },
);

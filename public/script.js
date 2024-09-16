let mediaRecorder;
let audioChunks = [];
let micStream;

// let audio_q = null;
// let audio_q_e = null;
// let img_q = null;

let form = {
    answers: [],
    audio: null,
    audio_explination: null,
    img: null,
    serie_num: null,
    question_num: null,
};

let series = [];

let selectedSerie = {

};

let selectedQuestion = {

};

const toggleRecording = async (button, audioPlayer, container, callBack) => {
    if (button.classList.contains('recording')) {
        // Stop recording
        mediaRecorder.stop();
        micStream.getTracks().forEach(track => track.stop());

        // Remove the .recording class and reset button text
        button.classList.remove('recording');
        button.textContent = '';
        container.classList.remove('recording');
    } else {
        try {
            // Request access to the user's microphone
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Initialize MediaRecorder for recording
            mediaRecorder = new MediaRecorder(micStream);
            mediaRecorder.start();
            audioChunks = [];

            // Add the .recording class and change button text
            button.classList.add('recording');
            button.textContent = 'R';
            container.classList.add('recording');

            // Collect audio data into chunks
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            // Handle stopping and processing audio
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer.src = audioUrl;

                callBack && callBack(audioUrl);
            };
        } catch (error) {
            alert('Error accessing the microphone');
            console.error(error);
        }
    }
};

// Event Listeners for Question Audio
document.getElementById('record-question-audio').addEventListener('click', () => {
    const recordButton = document.getElementById('record-question-audio');
    const audioPlayer = document.getElementById('question-audio-player');
    const container = document.getElementById('s-audio');
    toggleRecording(recordButton, audioPlayer, container, (url) => {
        form.audio = url;
    });
});

// Event Listeners for Explanation Audio
document.getElementById('record-explanation-audio').addEventListener('click', () => {
    const recordButton = document.getElementById('record-explanation-audio');
    const audioPlayer = document.getElementById('explanation-audio-player');
    const container = document.getElementById('s-audio-explanation');
    toggleRecording(recordButton, audioPlayer, container, (url)=>{
        form.audio_explination = url;
    });
});

const selectQuestion = (num) => {

    // get question
    let question = selectedSerie.questions.find(question => question.num == num) ?? {};

    selectedQuestion = question;

    form = {
        answer: [],
        audio: null,
        audio_explination: null,
        img: null,
        serie_num: null,
        question_num: null,
    }

    if (!question) return;

    // fill form
    form.serie_num = selectedSerie.num;
    form.question_num = question.num;
    form.img = question.img;
    form.audio = question.audio;
    form.audio_explination = question.audio_explination;
    form.answer = question.answer;

    // selectedSerie-num selectedQuestion-num
    document.getElementById('selectedSerie-num').textContent = selectedSerie.num;
    document.getElementById('selectedQuestion-num').textContent = question.num;

    // set image
    let img = document.getElementById('s-image');
    img.src = form.img;

    // set answers
    let checks = document.querySelectorAll('#answer-checks input[type="checkbox"]');
    checks.forEach((check) => {
        check.checked = false;
    });
    form.answer.forEach((answer) => {
        let check = document.querySelector(`#answer-checks input[value="${answer}"]`);
        if (check) {
            check.checked = true;
        }
    });

    // set audio
    let audio = document.getElementById('question-audio-player');
    audio.src = form.audio;

    // set audio explanation
    let audio_explination = document.getElementById('explanation-audio-player');
    audio_explination.src = form.audio_explination;

};

const selectSerie = (num) => {

    if(num == null) {
        selectedSerie = {};
        selectedQuestion = {};
        form = {
            answer: [],
            audio: null,
            audio_explination: null,
            img: null,
            serie_num: null,
            question_num: null,
        }

        document.getElementById('selectedSerie-num').textContent = "";
        document.getElementById('selectedQuestion-num').textContent = "";
        document.getElementById('s-image').src = "";
        document.getElementById('question-audio-player').src = "";
        document.getElementById('explanation-audio-player').src = "";
        document.getElementById('answer-checks').innerHTML = "";
        document.getElementById('questionList').innerHTML = "";

        return;
    }
    
    let serie = series.find(serie => serie.num == num) ?? {};

    selectedSerie = serie;

    if (!serie) return;

    let questionsSelect = document.getElementById('questionList');

    questionsSelect.innerHTML = "";
    serie.questions.forEach((question) => {
        let option = document.createElement('i');
        option.classList.add('list-group-item');
        option.setAttribute('value', question.num);
        option.textContent = "Question " + question.num;
        questionsSelect.appendChild(option);
    });

    // add create question
    let option = document.createElement('i');
    option.setAttribute('value', 'create');
    option.textContent = "Create Question";
    option.classList.add('list-group-item');
    questionsSelect.appendChild(option);

    // get all options
    let options = document.querySelectorAll('.list-questions i');

    // on select question
    options.forEach((option) => option.addEventListener('click', (e) => {

        let questionNum = e.target.getAttribute('value');

        // remove all selected classes from .list-questions i
        document.querySelectorAll('.list-questions i').forEach((el) => {
            if (el.classList.contains('selected')) {
                el.classList.remove('selected');
            }
        });

        if (questionNum == "create") {
            // TODO: create a question
            createAQuestion();
            return;
        }

        // add selected class to selected
        e.target.classList.add('selected');

        selectQuestion(questionNum);

    }));

}

const watchChanges = () => {
    // upload audios
    document.getElementById('upload-explanation-audio').addEventListener('click', () => {
        // get audioFile2
        let audioFile = document.getElementById('audioFile2');
        audioFile.click();

        // on change
        audioFile.addEventListener('change', (e) => {
            let file = e.target.files[0];
            let audio = document.getElementById('explanation-audio-player');
            audio.src = URL.createObjectURL(file);

            // on audio loaded
            audio.addEventListener('loadeddata', () => {
                form.audio_explination = audio.src;
            });
        });
    });
    document.getElementById('upload-question-audio').addEventListener('click', () => {
        // get audioFile
        let audioFile = document.getElementById('audioFile1');
        audioFile.click();

        // on change
        audioFile.addEventListener('change', (e) => {
            let file = e.target.files[0];
            let audio = document.getElementById('question-audio-player');
            audio.src = URL.createObjectURL(file);

            // on audio loaded
            audio.addEventListener('loadeddata', () => {
                form.audio = audio.src;
            });
        });
    });

    // set image
    document.getElementById('s-image-container').addEventListener('click', () => {
        // get imageFile
        let imageFile = document.getElementById('imageFile');
        imageFile.click();

        // on change
        imageFile.addEventListener('change', (e) => {
            let file = e.target.files[0];
            let img = document.getElementById('s-image');
            img.src = URL.createObjectURL(file);

            // on image loaded
            img.addEventListener('load', () => {
                form.img = img.src;
            });
        });
    });

    // update answers
    let checks = document.querySelectorAll('#answer-checks input[type="checkbox"]');
    checks.forEach((check) => {
        check.addEventListener('change', (e) => {
            let value = e.target.value;
            if (e.target.checked) {
                form.answer.push(value);
            } else {
                form.answer = form.answer.filter((answer) => answer != value);
            }
        });
    });

    
}

const createASerie = async () => {
    let serie = {
        num: parseInt( series[series.length-1].num) + 1,
        description: '', 
        questions: []
    }

    // add serie to series
    series.push(serie);

    // add serie to select
    let option = document.createElement('option');
    option.value = serie.num;
    option.textContent = "Serie " + serie.num;
    option.selected = true;
    document.getElementById('serieSelect').appendChild(option);

    // 
    services.createSeries(serie);

    let questionsSelect = document.getElementById('questionList');

    questionsSelect.innerHTML = "";
    
    // add create question
    let option2 = document.createElement('i');
    option2.setAttribute('value', 'create');
    option2.textContent = "Create Question";
    option2.classList.add('list-group-item');
    questionsSelect.appendChild(option2);
}

const createAQuestion = async () => {

    let nextNum = 1;

    if(selectedSerie.questions.length > 0) {
        lastQ = selectedSerie.questions[selectedSerie.questions.length - 1];
        nextNum = parseInt(lastQ.num) + 1;
    }

    selectedSerie.questions.push(
        {
            "num": nextNum,
            "img": "",
            "audio": "",
            "audio_explination": "",
            "answer": []
        }
    );

    selectSerie(selectedSerie.num);

    await services.updateSeries(selectedSerie.num,selectedSerie);

}

// saveQuestion
const saveQuestion = async () => {

    let out = await services.uploadSeriesAssets(form.img,form.audio,form.audio_explination);

    console.log(out);

    let question = {
        num: form.question_num,
        img: out.image,
        audio: out.audio,
        audio_explination: out.audioExplanation,
        answer: form.answer,
    }

    // update question on serie and upload it
    // find the question
    q = selectedSerie.questions.find((q)=>q.num==form.question_num);
    qi = selectedSerie.questions.indexOf(q);

    if(q) {
        
        selectedSerie.questions[qi] = question;

        // start loading
        document.getElementById("saveQuestion").classList.add('loading');
        document.getElementById("saveQuestion").disabled = true;
        await services.updateSeries(form.serie_num,selectedSerie);
        document.getElementById("saveQuestion").classList.remove('loading');
        document.getElementById("saveQuestion").disabled = false;

    }

}
document.getElementById("saveQuestion").addEventListener('click',saveQuestion);

const deleteQuestion = async () => {
    console.log('deleteQuestion');
    // find the question
    q = selectedSerie.questions.find((q)=>q.num==form.question_num);
    qi = selectedSerie.questions.indexOf(q);

    if(q) {
        selectedSerie.questions.splice(qi,1);
        selectSerie(selectedSerie.num);

        // start loading
        document.getElementById("saveQuestion").classList.add('loading');
        document.getElementById("saveQuestion").disabled = true;
        await services.updateSeries(form.serie_num,selectedSerie);
        document.getElementById("saveQuestion").classList.remove('loading');
        document.getElementById("saveQuestion").disabled = false;
    }
}

const deleteSerie = async () => {

    let s = series.find((s)=>s.num==selectedSerie.num);
    si = series.indexOf(s);

    if(s) {

        // start loading
        document.getElementById("saveQuestion").classList.add('loading');
        document.getElementById("saveQuestion").disabled = true;
        await services.deleteSeries(selectedSerie.num);
        document.getElementById("saveQuestion").classList.remove('loading');
        document.getElementById("saveQuestion").disabled = false;

        // remove serie from select
        let seriesSelect = document.getElementById('serieSelect');
        let option = document.querySelector(`#serieSelect option[value="${selectedSerie.num}"]`);
        seriesSelect.removeChild(option);

        series.splice(si,1);
        selectSerie(null);
    }
}

const start = () => {

    let seriesSelect = document.getElementById('serieSelect');

    // ges series
    services.getSeries().then((data) => {
        series = data;
        data.forEach((serie) => {
            let option = document.createElement('option');
            option.value = serie.num;
            option.textContent = "Serie " + serie.num;
            seriesSelect.appendChild(option);
        });

        // add create serie
        let option = document.createElement('option');
        option.value = "create";
        option.textContent = "Create Serie";
        seriesSelect.appendChild(option);
    });

    // on select serie
    seriesSelect.addEventListener('change', (e) => {
        let serieNum = e.target.value;
        if (serieNum == "create") {
            // TODO: creaet a new serie
            createASerie();
            return;
        }
        selectSerie(serieNum);
    });
}

start();
watchChanges();
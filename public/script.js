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

let currentQuestionIndex = null;

let questionLoading = (isLoading) => {
    const loader = document.getElementById('question-loader');
    if (isLoading) {
        loader.classList.remove('d-none');
    } else {
        loader.classList.add('d-none');
    }
}

// Helper to select question by index in selectedSerie.questions
const selectQuestionByIndex = async (idx) => {
    if (!selectedSerie.questions || selectedSerie.questions.length === 0) return;
    try {
        questionLoading(true);
        if (idx < 0) idx = 0;
        if (idx >= selectedSerie.questions.length) idx = selectedSerie.questions.length - 1;
        currentQuestionIndex = idx;
        await selectQuestion(selectedSerie.questions[idx].num);
        questionLoading(false)
    }
    catch (error) {
        console.error('Error selecting question by index:', error);
        questionLoading(false)
    }
}

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

const selectQuestion = async (num) => {
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
    let imgPromise = new Promise((resolve) => {
        if (form.img) {
            img.onload = () => {
                resolve();
                console.log("image loaded");
            };
            img.onerror = () => {
                resolve();
                console.log("image not loaded something wrong");
            };
            img.src = form.img;
        } else {
            img.src = "";
            resolve();
        }
    });

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
    let audioPromise = new Promise((resolve) => {
        if (form.audio) {
            audio.onloadeddata = () => {
                resolve()
                console.log("audio loaded");
            };
            audio.onerror = () => {
                resolve();
                console.log("audio not loaded something wrong");
            };
            audio.src = form.audio;
        } else {
            audio.src = "";
            resolve();
        }
    });

    // set audio explanation
    let audio_explination = document.getElementById('explanation-audio-player');
    let audioExplPromise = new Promise((resolve) => {
        if (form.audio_explination) {
            audio_explination.onloadeddata = () => {
                resolve();
                console.log("audio explanation loaded");
            };
            audio_explination.onerror = () => {
                resolve();
                console.log("audio explanation not loaded something wrong");
            };
            audio_explination.src = form.audio_explination;
        } else {
            audio_explination.src = "";
            resolve();
        }
    });

    // set currentQuestionIndex
    currentQuestionIndex = selectedSerie.questions.findIndex(q => q.num == num);

    // Wait for all assets to load
    await Promise.all([imgPromise, audioPromise, audioExplPromise]);

    console.log("Assets loaded successfully");
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

    // select the first question if exists
    if (serie.questions && serie.questions.length > 0) {
        selectQuestionByIndex(0);
        // highlight the first question in the list
        let firstOption = document.querySelector('.list-questions i[value="' + serie.questions[0].num + '"]');
        if (firstOption) firstOption.classList.add('selected');
    }
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
                checkAssetsLoaded();
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
                checkAssetsLoaded();
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
                checkAssetsLoaded();
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

// Add event listeners for prev/next buttons
const prevQ = async () => {
    if (!selectedSerie.questions || selectedSerie.questions.length === 0) return;
    if (currentQuestionIndex === null) {
        currentQuestionIndex = selectedSerie.questions.findIndex(q => q.num == form.question_num);
    }
    if (currentQuestionIndex > 0) {
        await saveQuestion();
        selectQuestionByIndex(currentQuestionIndex - 1);
    }
};

const nextQ = async () => {
    if (!selectedSerie.questions || selectedSerie.questions.length === 0) return;
    if (currentQuestionIndex === null) {
        currentQuestionIndex = selectedSerie.questions.findIndex(q => q.num == form.question_num);
    }
    if (currentQuestionIndex < selectedSerie.questions.length - 1) {
        await saveQuestion();
        selectQuestionByIndex(currentQuestionIndex + 1);
    }
}

// Bulk image upload logic for sidebar
let bulkImages = [];

const bulkDrop = document.getElementById('bulk-image-drop');
const bulkInput = document.getElementById('bulk-image-input');
const bulkPreview = document.getElementById('bulk-image-preview');
const bulkSubmit = document.getElementById('bulk-image-submit');
const bulkDropText = document.getElementById('bulk-image-drop-text');

// Drag & drop events
bulkDrop.addEventListener('click', () => bulkInput.click());
bulkDrop.addEventListener('dragover', e => {
    e.preventDefault();
    bulkDrop.style.background = '#e9ecef';
});
bulkDrop.addEventListener('dragleave', e => {
    e.preventDefault();
    bulkDrop.style.background = '#f8f9fa';
});
bulkDrop.addEventListener('drop', e => {
    e.preventDefault();
    bulkDrop.style.background = '#f8f9fa';
    handleBulkFiles(e.dataTransfer.files);
});
bulkInput.addEventListener('change', e => {
    handleBulkFiles(e.target.files);
});

function handleBulkFiles(fileList) {
    bulkImages = [];
    bulkPreview.innerHTML = '';
    for (let file of fileList) {
        if (!file.type.startsWith('image/')) continue;
        bulkImages.push(file);
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '40px';
        img.style.height = '40px';
        img.style.objectFit = 'cover';
        img.style.border = '1px solid #ccc';
        img.style.borderRadius = '4px';
        bulkPreview.appendChild(img);
    }
    bulkSubmit.disabled = bulkImages.length === 0;
    bulkDropText.style.display = bulkImages.length === 0 ? 'block' : 'none';
}

// Bulk submit logic
bulkSubmit.addEventListener('click', async () => {
    if (!selectedSerie || !selectedSerie.num || bulkImages.length === 0) return;
    bulkSubmit.disabled = true;
    bulkSubmit.textContent = 'Uploading...';

    let nextNum = 1;
    if (selectedSerie.questions && selectedSerie.questions.length > 0) {
        nextNum = parseInt(selectedSerie.questions[selectedSerie.questions.length - 1].num) + 1;
    }

    for (let i = 0; i < bulkImages.length; i++) {
        try {
            // Upload image only, no audio/explanation
            let out = await services.uploadSeriesAssets(bulkImages[i], null, null);
            let question = {
                num: nextNum++,
                img: out.image,
                audio: "",
                audio_explination: "",
                answer: []
            };
            selectedSerie.questions.push(question);
        } catch (err) {
            console.error('Failed to upload image:', bulkImages[i], err);
        }
    }
    await services.updateSeries(selectedSerie.num, selectedSerie);
    selectSerie(selectedSerie.num);

    // Reset UI
    bulkImages = [];
    bulkPreview.innerHTML = '';
    bulkSubmit.disabled = true;
    bulkSubmit.textContent = 'Submit Bulk Images';
    bulkDropText.style.display = 'block';
    alert('Bulk images uploaded and questions created!');
});

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



// Add event listener for "Remove Image" button
document.getElementById('remove-image-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent triggering the image container click event
    const img = document.getElementById('s-image');
    img.src = ''; // Clear the image source
    form.img = null; // Reset the form's image field
});

// Add drag-and-drop functionality for the image container
const imageContainer = document.getElementById('s-image-container');
imageContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageContainer.style.backgroundColor = '#e9ecef'; // Highlight dropzone
});
imageContainer.addEventListener('dragleave', () => {
    imageContainer.style.backgroundColor = ''; // Reset dropzone highlight
});
imageContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    imageContainer.style.backgroundColor = ''; // Reset dropzone highlight

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const img = document.getElementById('s-image');
        img.src = URL.createObjectURL(file); // Display the dropped image
        form.img = img.src; // Update the form's image field
    }
});

// Function to check if all assets are loaded
function checkAssetsLoaded() {
    const saveButton = document.getElementById("saveQuestion");
    const isImageLoaded = form.img !== null && form.img !== "";
    const isAudioLoaded = form.audio !== null && form.audio !== "";
    const isAudioExplanationLoaded = form.audio_explination !== null && form.audio_explination !== "";

    if (isImageLoaded && isAudioLoaded && isAudioExplanationLoaded) {
        saveButton.disabled = false;
    } else {
        saveButton.disabled = true;
        alert("Please upload all assets (image, audio, audio explanation) before saving.");
    }
}

// Ensure save button is initially disabled
document.addEventListener('DOMContentLoaded', () => {
    checkAssetsLoaded();
});
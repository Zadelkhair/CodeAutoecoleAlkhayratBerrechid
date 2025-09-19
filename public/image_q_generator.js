document.addEventListener('DOMContentLoaded', () => {
    const genImgBtn = document.getElementById('generate-image-btn');
    if (genImgBtn) {
        genImgBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Set default values before showing modal
            document.getElementById('qText').value = "تناول الأدوية مع الكحول ، يمكن يجعل السائق:";
            document.getElementById('qQuestionChoice1and2').value = "عصبي بشكل غير عادي";
            document.getElementById('qChoice1').value = "نعم";
            document.getElementById('qChoice2').value = "لا";
            document.getElementById('qQuestionChoice3and4').value = "يعرضه لخطر النوم أثناء السياقة";
            document.getElementById('qChoice3').value = "نعم";
            document.getElementById('qChoice4').value = "لا";
            document.getElementById('qFormat').value = "format-4";
            
            const modal = new bootstrap.Modal(document.getElementById('qImageGenModal'));
            modal.show();

        });
    }
});

// Utility: convert HTML element to image (using html2canvas)
function htmlToImage(element, callback) {
    if (window.html2canvas) {
        html2canvas(element).then(canvas => {
            callback(canvas.toDataURL("image/png"));
        });
    } else {
        alert("html2canvas library is required!");
    }
}

// Handle image preview
document.getElementById('qImageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('qImagePreview');
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            preview.src = ev.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
});

// Generate question image
document.getElementById('qImageGenBtn').addEventListener('click', function() {

    console.log("test")
    // Collect form data
    const imgSrc = document.getElementById('qImagePreview').src;
    const question = document.getElementById('qText').value;
    // qC1and2
    qc1and2 = document.getElementById('qQuestionChoice1and2').value;
    qc3and4 = document.getElementById('qQuestionChoice3and4').value;
    const choices = [
        document.getElementById('qChoice1').value,
        document.getElementById('qChoice2').value,
        document.getElementById('qChoice3').value,
        document.getElementById('qChoice4').value
    ].filter(c => c.trim() !== "");
    const format = document.getElementById('qFormat').value;

    // Build HTML for rendering
    const container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    container.style.position = 'relative';
    container.style.background = '#0a0a0aff';
    container.style.fontFamily = 'Arial, sans-serif';

    // Create a flex container for the image
    const imgContainer = document.createElement('div');
    imgContainer.style.position = 'absolute';
    imgContainer.style.top = '0';
    imgContainer.style.left = '0';
    imgContainer.style.width = '100%';
    imgContainer.style.height = '60%';
    imgContainer.style.display = 'flex';
    imgContainer.style.alignItems = 'center';
    imgContainer.style.justifyContent = 'center';
    imgContainer.style.overflow = 'hidden';
    imgContainer.style.background = 'transparent';

    // Image
    const img = document.createElement('img');
    if (imgSrc) img.src = imgSrc;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    
    imgContainer.appendChild(img);
    container.appendChild(imgContainer);

    // Question and choices
    const qBlock = document.createElement('div');
    qBlock.style.position = 'absolute';
    qBlock.style.left = '0';
    qBlock.style.top = '60%';
    qBlock.style.width = '100%';
    qBlock.style.height = '40%';
    qBlock.style.overflow = 'hidden';
    qBlock.style.color = '#fff';
    qBlock.style.padding = '16px';
    // qBlock.style.textAlign = 'right';
    qBlock.style.background = 'rgba(0,0,0,0.7)';
    qBlock.style.fontSize = '.9em';

    if (format === 'format-1') {
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);


        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-12';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-12';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }
    else if (format === 'format-2') {
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-12';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-12';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-12';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }
    else if (format === 'format-3') {
        
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-6';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-6';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        const choice4Div = document.createElement('div');
        choice4Div.className = 'col-6';
        choice4Div.style.marginBottom = '4px';
        choice4Div.textContent = `4. ${choices[3] || ''}`;
        row.appendChild(choice4Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }
    else if (format === 'format-4') {

        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add qc1and2
        const qc1and2Div = document.createElement('div');
        qc1and2Div.className = 'col-12';
        qc1and2Div.style.paddingInlineStart = '20px';
        qc1and2Div.style.marginBottom = '4px';
        qc1and2Div.textContent = qc1and2;
        row.appendChild(qc1and2Div);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-6';
        choice1Div.style.paddingInlineStart = '30px';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add qc3and4
        const qc3and4Div = document.createElement('div');
        qc3and4Div.className = 'col-12';
        qc3and4Div.style.paddingInlineStart = '20px';
        qc3and4Div.style.marginBottom = '4px';
        qc3and4Div.textContent = qc3and4;
        row.appendChild(qc3and4Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-6';
        choice3Div.style.paddingInlineStart = '30px';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        const choice4Div = document.createElement('div');
        choice4Div.className = 'col-6';
        choice4Div.style.marginBottom = '4px';
        choice4Div.textContent = `4. ${choices[3] || ''}`;
        row.appendChild(choice4Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);

    }
    else if (format === 'format-5') {
        
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add qc1and2
        const qc1and2Div = document.createElement('div');
        qc1and2Div.className = 'col-12';
        qc1and2Div.style.marginBottom = '4px';
        qc1and2Div.textContent = qc1and2;
        row.appendChild(qc1and2Div);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-6';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-6';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        const choice4Div = document.createElement('div');
        choice4Div.className = 'col-6';
        choice4Div.style.marginBottom = '4px';
        choice4Div.textContent = `4. ${choices[3] || ''}`;
        row.appendChild(choice4Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);

    }
    else if (format === 'format-6') {
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-6';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add qc3and4
        const qc3and4Div = document.createElement('div');
        qc3and4Div.className = 'col-12';
        qc3and4Div.style.marginBottom = '4px';
        qc3and4Div.textContent = qc3and4;
        row.appendChild(qc3and4Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-6';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        const choice4Div = document.createElement('div');
        choice4Div.className = 'col-6';
        choice4Div.style.marginBottom = '4px';
        choice4Div.textContent = `4. ${choices[3] || ''}`;
        row.appendChild(choice4Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }
    else if (format === 'format-7') {
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add qc1and2
        const qc1and2Div = document.createElement('div');
        qc1and2Div.className = 'col-12';
        qc1and2Div.style.marginBottom = '4px';
        qc1and2Div.textContent = qc1and2;
        row.appendChild(qc1and2Div);

        // add choices 1 and 2
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-6';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add choices 3 and 4
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-12';
        choice3Div.style.marginBottom = '4px';
        choice3Div.style.marginTop = '8px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);

        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }
    else if (format === 'format-8') {
        // row
        const row = document.createElement('div');
        row.className = 'row';

        // Question text
        const qText = document.createElement('div');
        qText.className = 'col-12';
        qText.textContent = question;
        qText.style.marginBottom = '10px';
        qText.style.fontWeight = 'bold';
        row.appendChild(qText);

        // add choices 1
        const choice1Div = document.createElement('div');
        choice1Div.className = 'col-12';
        choice1Div.style.marginBottom = '4px';
        choice1Div.textContent = `1. ${choices[0] || ''}`;
        row.appendChild(choice1Div);

        // add qc2and3
        const qc3and4Div = document.createElement('div');
        qc3and4Div.className = 'col-12';
        qc3and4Div.style.marginBottom = '4px';
        qc3and4Div.textContent = qc3and4;
        row.appendChild(qc3and4Div);

        const choice2Div = document.createElement('div');
        choice2Div.className = 'col-6';
        choice2Div.style.marginBottom = '4px';
        choice2Div.textContent = `2. ${choices[1] || ''}`;
        row.appendChild(choice2Div);

        // add choices 3
        const choice3Div = document.createElement('div');
        choice3Div.className = 'col-6';
        choice3Div.style.marginBottom = '4px';
        choice3Div.textContent = `3. ${choices[2] || ''}`;
        row.appendChild(choice3Div);


        qBlock.appendChild(row);

        container.appendChild(qBlock);
    }

    

    // Render to image
    document.getElementById('qImageGenResult').innerHTML = '';
    document.getElementById('qImageGenResult').appendChild(container);

    console.log('Container for image generation:', container);

    // Use html2canvas to generate image
    htmlToImage(container, function(dataUrl) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.marginTop = '10px';
        document.getElementById('qImageGenResult').innerHTML = '';
        document.getElementById('qImageGenResult').appendChild(img);

        // Show "Select & Close" button
        const selectBtn = document.getElementById('qImageGenSelectBtn');
        selectBtn.style.display = 'inline-block';
        selectBtn.dataset.img = dataUrl; // Store the image data for selection
    });
});

// Handle "Select & Close" button
document.getElementById('qImageGenSelectBtn').addEventListener('click', function() {
    const imgData = this.dataset.img;
    // Example: set as main image preview (replace with your logic)
    const mainImg = document.getElementById('s-image');
    if (mainImg && imgData) {
        mainImg.src = imgData;
    }
    // Optionally update form.img if needed
    if (typeof form !== 'undefined') {
        form.img = imgData;
    }
    // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('qImageGenModal'));
    if (modal) modal.hide();
    // Hide select button again
    this.style.display = 'none';
});

// You must include html2canvas in your HTML for this to work:
// <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>

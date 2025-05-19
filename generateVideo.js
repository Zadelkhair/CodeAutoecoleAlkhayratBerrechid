const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const Jimp = require('jimp'); // Import Jimp for image creation

// Path to a default blank image
const defaultBlankImage = path.join(__dirname, 'default_blank.png');

// Ensure the default blank image exists
const ensureDefaultBlankImage = async () => {
    if (!fs.existsSync(defaultBlankImage)) {
        console.warn('Default blank image not found. Creating one...');
        const blankImage = await new Jimp(1280, 720, 0x000000FF); // Create a black image
        await blankImage.writeAsync(defaultBlankImage);
        console.log('Default blank image created.');
    }
};

// Function to generate a video for a series
const generateVideoForSeries = async (series, outputDir) => {
    await ensureDefaultBlankImage(); // Ensure the blank image exists

    const images = series.questions.map(q => path.join(__dirname, q.img));
    const audios = series.questions.map(q => q.audio ? path.join(__dirname, q.audio) : null);
    const explanations = series.questions.map(q => q.audio_explination ? path.join(__dirname, q.audio_explination) : null);

    const videoOutput = path.join(outputDir, `series_${series.num}.mp4`);
    const tempDir = path.join(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const resizedImages = images.map((img, index) => {
        const resizedImage = path.join(tempDir, `resized_${index}.png`);
        if (fs.existsSync(img)) {
            ffmpeg(img)
                .outputOptions('-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2')
                .saveSync(resizedImage);
        } else {
            console.warn(`Image not found: ${img}`);
            fs.copyFileSync(defaultBlankImage, resizedImage); // Use a valid blank image
        }
        return resizedImage;
    });

    const video = ffmpeg();

    resizedImages.forEach((img, index) => {
        video.input(img);
        if (audios[index] && fs.existsSync(audios[index])) {
            video.input(audios[index]);
        }
    });

    video
        .outputOptions('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30')
        .on('end', () => {
            console.log(`Video created: ${videoOutput}`);
            fs.rmSync(tempDir, { recursive: true, force: true });
        })
        .on('error', (err) => {
            console.error(`Error creating video: ${err.message}`);
        })
        .save(videoOutput);
};

// Example usage
const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf-8'));
const outputDir = path.join(__dirname, 'videos');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

db.series.forEach(series => {
    generateVideoForSeries(series, outputDir);
});

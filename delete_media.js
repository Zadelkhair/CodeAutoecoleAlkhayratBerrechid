const fs = require('fs');
const path = require('path');

// Paths
const dbPath = path.join(__dirname, 'db.json');
const assetsPath = path.join(__dirname, 'docs', 'assets');

// Load the database
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Collect all used assets
const usedAssets = new Set();
db.series.forEach((serie) => {
    serie.questions.forEach((question) => {
        if (question.img) usedAssets.add(question.img);
        if (question.audio) usedAssets.add(question.audio);
        if (question.audio_explination) usedAssets.add(question.audio_explination);
    });
});

let unusedCount = 0;

// Scan the assets directory
const deleteUnusedAssets = (directory) => {
    const files = fs.readdirSync(directory);

    files.forEach((file) => {
        const filePath = path.join(directory, file);

        if (fs.statSync(filePath).isDirectory()) {
            // Recursively check subdirectories
            deleteUnusedAssets(filePath);
        } else {
            // Check if the file is used
            const relativePath = path.relative(path.join(__dirname, 'docs'), filePath).replace(/\\/g, '/');
            if (!usedAssets.has(relativePath)) {
                unusedCount++;
                console.log(`${unusedCount} Deleting unused asset: ${relativePath}`);
                fs.unlinkSync(filePath);
            }
        }
    });
};

// Start cleaning
deleteUnusedAssets(assetsPath);

console.log('Unused assets cleanup completed.');

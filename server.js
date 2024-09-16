const express = require('express');
const fs = require('fs');
const path = require('path'); // Import path to manage file paths
const fileUpload = require('express-fileupload');
const dotenv = require('dotenv');
const simpleGit = require('simple-git');

dotenv.config();

const app = express();
const port = 5050;

// Middleware to parse JSON bodies
app.use(express.json());

app.use(fileUpload());

// Serve static files from the "public" directory
app.use(express.static('./public'));

// use another static directory for the docs
app.use('/assets', express.static('./docs/assets'));

// Function to read data from db.json
const readDatabase = () => {
    const data = fs.readFileSync('db.json', 'utf-8');
    return JSON.parse(data);
};

// Function to write data to db.json
const writeDatabase = (data) => {
    fs.writeFileSync('db.json', JSON.stringify(data, null, 2));
};

// GET all series
app.get('/series', (req, res) => {
    const db = readDatabase();
    res.json(db.series);
});

// GET a specific series by number
app.get('/series/:num', (req, res) => {
    const db = readDatabase();
    const seriesNum = parseInt(req.params.num);
    const series = db.series.find(s => s.num === seriesNum);

    if (!series) {
        return res.status(404).json({ message: 'Series not found' });
    }
    res.json(series);
});

// PUT (update) a specific series by number
app.put('/series/:num', (req, res) => {
    const db = readDatabase();
    const seriesNum = parseInt(req.params.num);
    const seriesIndex = db.series.findIndex(s => s.num === seriesNum);

    if (seriesIndex === -1) {
        return res.status(404).json({ message: 'Series not found' });
    }

    // Update series with new data from the request body
    db.series[seriesIndex] = { ...db.series[seriesIndex], ...req.body };

    // Write updated data back to db.json
    writeDatabase(db);

    res.json({ message: 'Series updated successfully', series: db.series[seriesIndex] });
});

// Create a new series
app.post('/series', (req, res) => {
    const db = readDatabase();
    const newSeries = req.body;

    // Check if the series number already exists
    if (db.series.find(s => s.num === newSeries.num)) {
        return res.status(400).json({ message: 'Series number already exists' });
    }

    // Add the new series to the database
    db.series.push(newSeries);

    // Write updated data back to db.json
    writeDatabase(db);

    res.status(201).json({ message: 'Series created successfully', series: newSeries });
});

// Middleware to handle file uploads (without multer)
app.post('/question/assets/upload', (req, res) => {
    // Log req.files to check if any files were uploaded
    console.log('Uploaded files:', req.files);

    // Check if request contains files
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    // Access the uploaded files (e.g., image, audio, and audio explanation)
    const imageFile = req.files.image;
    const audioFile = req.files.audio;
    const audioExplanationFile = req.files.audioExplanation;

    // Ensure the directory exists
    const uploadDir = path.join(__dirname, 'docs/assets/new_series');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Check if image file is provided and move it
    let imageFileName = '';
    if (imageFile) {
        imageFileName = Date.now() + '_' + imageFile.name;
        imageFile.mv(path.join(uploadDir, imageFileName), (err) => {
            if (err) {
                return res.status(500).send('Error saving image: ' + err);
            }
        });
    }

    // Check if audio file is provided and move it
    let audioFileName = '';
    if (audioFile) {
        audioFileName = Date.now() + '_' + audioFile.name;
        audioFile.mv(path.join(uploadDir, audioFileName), (err) => {
            if (err) {
                return res.status(500).send('Error saving audio: ' + err);
            }
        });
    }

    // Check if audio explanation file is provided and move it
    let audioExplanationFileName = '';
    if (audioExplanationFile) {
        audioExplanationFileName = Date.now() + '_' + audioExplanationFile.name;
        audioExplanationFile.mv(path.join(uploadDir, audioExplanationFileName), (err) => {
            if (err) {
                return res.status(500).send('Error saving audio explanation: ' + err);
            }
        });
    }

    // Send a response after all files are uploaded
    res.status(200).send({
        message: 'Files uploaded successfully',
        image: imageFileName ? 'assets/new_series' + '/' + imageFileName : null,
        audio: audioFileName ? 'assets/new_series' + '/' + audioFileName : null,
        audioExplanation: audioExplanationFileName ? 'assets/new_series' + '/' + audioExplanationFileName : null
    });
});

// delete a series by number
app.delete('/series/:num', (req, res) => {
    const db = readDatabase();
    const seriesNum = parseInt(req.params.num);
    const seriesIndex = db.series.findIndex(s => s.num === seriesNum);

    if (seriesIndex === -1) {
        return res.status(404).json({ message: 'Series not found' });
    }

    // Remove the series from the database
    db.series.splice(seriesIndex, 1);

    // Write updated data back to db.json
    writeDatabase(db);

    res.json({ message: 'Series deleted successfully' });
});

// sync to docs api
app.post('/sync-to-docs',(req,res) => {

    // write the file
    fs.writeFileSync('./docs/db.js',`let database = ${JSON.stringify(readDatabase())}`);

    // success message
    res.json({message: 'synced successfully'});

});

// push to github
app.post('/push-to-github', async (req, res) => {
    try {
        const git = simpleGit();

        // Check for GitHub credentials (SSH key or access token) from the .env file
        const githubToken = process.env.GITHUB_TOKEN;
        const sshKeyPath = process.env.SSH_KEY_PATH;

        if (!githubToken && !sshKeyPath) {
            return res.status(400).json({ error: 'GitHub credentials are not provided in .env file.' });
        }

        // Use the GitHub credentials
        const remoteRepo = `https://${githubToken}@github.com/${process.env.GITHUB_USERNAME}/${process.env.GITHUB_REPO}.git`;

        git.outputHandler((command, stdout, stderr) => {
            stdout.on('data', (data) => {
                const message = data.toString();
                console.log('Progress:', message); // Log progress to the console
            });
        });

        // Add all changes to the staging area
        await git.add('./*');  // Stages all files (including server.js)

        // Commit changes
        await git.commit('Synced to docs - ' + new Date().toLocaleString());

        // If you have an SSH key, set it up for the push
        if (sshKeyPath) {
            git.sshKeyPath = path.resolve(sshKeyPath);
        }

        // Force push to the origin/main branch
        await git.push(remoteRepo, 'main', { '--force': null }); // Force push

        // Send success response
        res.json({ message: 'Pushed successfully' });
    } catch (error) {
        console.error('Error pushing to GitHub:', error);
        res.status(500).json({ error: 'Failed to push to GitHub', details: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

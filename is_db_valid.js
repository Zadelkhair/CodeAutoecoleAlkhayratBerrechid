const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Initialize Ajv
const ajv = new Ajv();

// Define the JSON schema for validation
const schema = {
    type: "object",
    properties: {
        series: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    num: { type: "integer" },
                    description: { type: "string" },
                    questions: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                num: { type: "integer" },
                                img: { type: ["string", "null"] },
                                audio: { type: ["string", "null"] },
                                audio_explination: { type: ["string", "null"] },
                                answer: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["num", "img", "audio", "audio_explination", "answer"]
                        }
                    }
                },
                required: ["num", "description", "questions"]
            }
        }
    },
    required: ["series"]
};

// Load and parse db.json
const dbPath = path.join(__dirname, 'db.json');
let dbData;

try {
    dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
} catch (error) {
    console.error("Error parsing db.json:", error.message);
    process.exit(1);
}

// Validate db.json against the schema
const validate = ajv.compile(schema);
const valid = validate(dbData);

if (valid) {
    console.log("db.json is valid.");
} else {
    console.error("db.json is invalid. Errors:");
    console.error(validate.errors);
    process.exit(1);
}

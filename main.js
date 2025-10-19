import { updateTriviaCubeData as refreshGameScene } from './game.js'; // Import the game update function
 import HARDCODED_CUBE_CONFIG from './toonMaterial.js';
// DATA will be initialized by user input.
let DATA = null; // Initialize DATA as null, to be populated by JSON object
// Export a getter function for DATA so other modules can access it
export function getData() {
    return DATA;
}

// Get references to DOM elements
const jsonDataInput = document.getElementById('json-data-input');
const loadPastedDataButton = document.getElementById('load-pasted-data-button'); // This button will open the modal
const clearDataButton = document.getElementById('clear-data-button'); // Now inside the modal
const messageArea = document.getElementById('message-area');
const dataLoaderModal = document.getElementById('data-loader-modal');
const closeModalButton = document.getElementById('close-modal-button');
const confirmLoadJsonButton = document.getElementById('confirm-load-json-button'); // New button in modal
const copyJsonButton = document.getElementById('copy-json-button'); // New button in modal
const jsonFileInput = document.getElementById('json-file-input');
const selectedFileNameModal = document.getElementById('selected-file-name-modal');
/**
 * Process the loaded JSON data.
 *
 * @param {string} jsonDataString - The JSON data as a string.
 * @param {string} source - The source of the data (e.g., "pasted text").
 */
function resolvePath(obj, pathString) {
    const pathArray = pathString.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
    let current = obj;
    for (const key of pathArray) { // 'key' here is a string, e.g., "questions", "0", "options"
        if (current && typeof current === 'object') { // This covers both objects and arrays
            if (key in current) { // Try direct access (works for object properties and array indices as strings)
                current = current[key];
            } else if (!Array.isArray(current)) { // If not an array and direct access failed, try case-insensitive for object keys
                const foundKey = Object.keys(current).find(k => k.toLowerCase() === key.toLowerCase());
                if (foundKey) {
                    console.warn(`[Main.js] resolvePath: Resolved "${key}" to "${foundKey}" case-insensitively for path "${pathString}".`);
                    current = current[foundKey];
                } else {
                    console.warn(`[Main.js] resolvePath: Could not resolve path "${pathString}" at key "${key}" (case-insensitive search failed for object).`);
                    return undefined;
                }
            } else { // It's an array, and 'key in current' failed (e.g. index out of bounds, or key is not a valid index string)
                 console.warn(`[Main.js] resolvePath: Could not resolve path "${pathString}" at key "${key}" in array. Current array:`, current);
                 return undefined;
            }
        } else {
            console.warn(`[Main.js] resolvePath: Invalid current object or path segment while resolving "${pathString}". Current:`, current, `Key: ${key}`);
            return undefined;
        }
    }
    return current;
}
function resolveDataRefs(dataObject) {
    if (!dataObject || !dataObject.cubeConfig || !dataObject.cubeConfig.faces || !dataObject.data) {
        console.warn('[Main.js] resolveDataRefs: Invalid dataObject structure for resolving refs. Cannot proceed.');
        return dataObject; // Return original if structure is not as expected
    }

    const faces = dataObject.cubeConfig.faces;
    const sourceData = dataObject.data;

    faces.forEach((face, index) => {
        const faceIdForLog = face.id || `index ${index}`;

        // Resolve dataRef for face.value
        if (face.dataRef) {
            try {
                const resolvedValue = resolvePath(sourceData, face.dataRef);
                if (resolvedValue === undefined) {
                    console.warn(`[Main.js] resolveDataRefs: dataRef "${face.dataRef}" for face "${faceIdForLog}" resolved to undefined.`);
                    face.value = undefined;
                } else {
                    face.value = resolvedValue;
                }
            } catch (error) {
                console.error(`[Main.js] resolveDataRefs: Error processing dataRef "${face.dataRef}" for face "${faceIdForLog}". Error: ${error.message}`);
                face.value = undefined;
            }
        }

        // Resolve variablesRef for face.variables
        if (face.variablesRef) {
            try {
                const resolvedVariables = resolvePath(sourceData, face.variablesRef);
                if (resolvedVariables === undefined) {
                    console.warn(`[Main.js] resolveDataRefs: variablesRef "${face.variablesRef}" for face "${faceIdForLog}" resolved to undefined. Template may render with missing data.`);
                    face.variables = {};
                } else if (typeof resolvedVariables === 'object' && resolvedVariables !== null) {
                    face.variables = resolvedVariables;
                } else {
                    console.warn(`[Main.js] resolveDataRefs: variablesRef "${face.variablesRef}" for face "${faceIdForLog}" did not resolve to an object. Resolved to:`, resolvedVariables);
                    face.variables = {};
                }
            } catch (error) {
                console.error(`[Main.js] resolveDataRefs: Error processing variablesRef "${face.variablesRef}" for face "${faceIdForLog}". Error: ${error.message}`);
                face.variables = {};
            }
        }

        // ✅ NEW templatedContent safeguard
        if (face.contentType === 'templatedContent' && !face.templateKey) {
            console.warn(`[Main.js] Face "${faceIdForLog}" is templatedContent but missing templateKey.`);
        }

        // If face has a questionId, try to attach the corresponding question object
        if (face.questionId) {
            try {
                const questionList = sourceData.questions || [];
                const matched = questionList.find(q => q.id === face.questionId || q.id === String(face.questionId));
                if (matched) {
                    // Attach popup content to the face for easy consumption by the game UI
                    face.popup = matched;
                } else {
                    console.warn(`[Main.js] resolveDataRefs: No question found for questionId "${face.questionId}" on face "${faceIdForLog}".`);
                }
            } catch (err) {
                console.error(`[Main.js] resolveDataRefs: Error resolving questionId "${face.questionId}" for face "${faceIdForLog}".`, err);
            }
        }
    });

    return dataObject;
}
function processLoadedData(jsonDataString, source) {
    if (!jsonDataString.trim()) {
        updateStatus(`No data provided from ${source}. Enter JSON data or ensure it's not just whitespace.`, 'error-message');
        return;
    }
    try {
        let newData = JSON.parse(jsonDataString);
        // The incoming JSON can be either the full { cubeConfig, data } shape OR
        // only the `data` portion (popup content). If it's only data, attach the
        // hardcoded cube config so the rest of the game (which expects DATA.cubeConfig)
        // continues to work.
        if (typeof newData !== 'object' || newData === null) {
            updateStatus("Invalid JSON format: Data must be a valid JSON object.", 'error-message');
            DATA = null; // Ensure DATA is reset if format is invalid
            if (typeof refreshGameScene === 'function') refreshGameScene(DATA);
            return;
        }

        // If user provided a full structure with cubeConfig, prefer that data but still
        // ensure the cubeConfig portion uses our hardcoded visuals (to keep consistency).
        if (newData.cubeConfig && newData.data) {
            // still attach hardcoded visuals to ensure faces/textures are stable
            newData.cubeConfig = HARDCODED_CUBE_CONFIG;
            newData = resolveDataRefs(newData);
            DATA = newData;
        } else {
            // Assume incoming object is the `data` section only
            const wrapped = { cubeConfig: HARDCODED_CUBE_CONFIG, data: newData };
            const resolved = resolveDataRefs(wrapped);
            DATA = resolved;
        }
        updateStatus(`Successfully loaded and processed new cube configuration and data from ${source}. See console for details.`, 'success-message');
        console.log("[Main.js] Successfully loaded and processed data:", DATA); // Added more context to log
        
        if (typeof refreshGameScene === 'function') {
            console.log('[Main.js] Calling refreshGameScene from processLoadedData.');
            refreshGameScene(DATA);
        } else {
            console.error('[Main.js] refreshGameScene function is not available to call.');
        }
    } catch (error) { // Catch errors from JSON.parse or resolveDataRefs if it throws
        updateStatus(`Error processing JSON from ${source}: ${error.message}. Please check the JSON syntax and data structure. See console for details.`, 'error-message');
        console.error(`[Main.js] Error in processLoadedData from ${source}:`, error); // Log the full error object
        DATA = null; // Clear data on error
        if (typeof refreshGameScene === 'function') refreshGameScene(DATA); // Refresh to default state
    }
}
/**
 * Update the message area with a message and class.
 *
 * @param {string} message - The message to display.
 * @param {string} className - The class to apply to the element ('success-message' or 'error-message').
 */
function updateStatus(message, className) {
    messageArea.textContent = message;
    messageArea.className = className; // Applies 'success-message' or 'error-message'
}
document.addEventListener('DOMContentLoaded', () => {
    // Prefill only the `data` portion (popup content); cube visuals/config are hardcoded in this script.
    jsonDataInput.value = JSON.stringify({
        "title": "History Quiz Cube",
        "initials": "HQC",
        "playerProfile": {
            "playerName": "Rosie",
            "score": 12500,
            "rank": "Ace Coder"
        },
        "questions": [
            {
                "id": "q1",
                "question": "What tool is represented on this cube face?",
                "options": { "A": "Telescope", "B": "Microscope", "C": "Magnifying Glass", "D": "Binoculars" },
                "correctAnswer": "C",
                "answerDetails": "Magnifying glass is used for close inspection.",
                "unlocksEntity": 3
            },
            {
                "id": "q2",
                "question": "This image represents a computer component. What is it?",
                "options": { "A": "CPU", "B": "GPU", "C": "Microchip", "D": "RAM" },
                "correctAnswer": "C",
                "unlocksEntity": 6
            },
            {
                "id": "q3",
                "question": "Which famous actor performed at the Elsinore Theater in Salem, Oregon during the 1920s?",
                "options": { "A": "Clark Gable", "B": "Charlie Chaplin", "C": "Humphrey Bogart", "D": "James Stewart" },
                "correctAnswer": "A",
                "answerDetails": "Clark Gable performed at the Elsinore Theater in Salem, Oregon in the 1920s before becoming a Hollywood legend.",
                "unlocksEntity": 11
            }
        ],
        "connections": [
            { "id": 1, "name": "Elsinore Theater", "category": "where", "description": "Historic performing arts venue in Salem, Oregon", "unlocked": true },
            { "id": 2, "name": "Salem", "category": "where", "description": "Capital city of Oregon", "unlocked": true },
            { "id": 3, "name": "George Washington", "category": "who", "description": "First President of the United States" },
            { "id": 6, "name": "Gold (Au)", "category": "what", "description": "Precious metal, chemical element" },
            { "id": 11, "name": "Clark Gable", "category": "who", "description": "American film actor who performed at Elsinore Theater in the 1920s", "unlocked": true }
        ],
        "relationships": [
            { "from": 1, "to": 2, "strength": "strong" },
            { "from": 11, "to": 1, "strength": "strong" },
            { "from": 11, "to": 2, "strength": "medium" }
        ]
    }, null, 2);
    // Event listener for the main "LOAD DATA" button to open the modal
    loadPastedDataButton.addEventListener('click', () => {
        dataLoaderModal.classList.remove('hidden');
        // Reset file input and its display text each time modal is opened
        if (jsonFileInput) jsonFileInput.value = ''; // Clear any previously selected file
        if (selectedFileNameModal) selectedFileNameModal.textContent = 'No file selected.';
        // Pre-fill with example if textarea is empty, or retain current content
        if (!jsonDataInput.value.trim()) {
            jsonDataInput.value = JSON.stringify({
                "cubeConfig": {"size": 1, "faces": [], "groundConfig": {}}, "data": {"message": "Paste your data here"}
            }, null, 2);
        }
    });
    // Event listener for the "Close" button on the modal
    closeModalButton.addEventListener('click', () => {
        dataLoaderModal.classList.add('hidden');
    });
    // Event listener for clicking outside the modal content to close it
    dataLoaderModal.addEventListener('click', (event) => {
        if (event.target === dataLoaderModal) { // Check if the click is on the overlay itself
            dataLoaderModal.classList.add('hidden');
        }
    });
    // Event listener for the "LOAD FROM TEXT" button inside the modal
    confirmLoadJsonButton.addEventListener('click', () => {
        const jsonDataString = jsonDataInput.value;
        processLoadedData(jsonDataString, "modal input");
        dataLoaderModal.classList.add('hidden'); // Close modal after attempting load
    });
    // Event listener for the "CLEAR" button inside the modal
    clearDataButton.addEventListener('click', () => {
        // Reset to default display-only data while preserving hardcoded cube visuals
        DATA = { cubeConfig: HARDCODED_CUBE_CONFIG, data: {} };
        jsonDataInput.value = '';
        updateStatus('Data cleared from input. Cube reset to default if no other data source is used.', 'success-message');
        console.log("Data cleared from modal input.");
        // Refresh the game scene to its default state.
        // updateTriviaCubeData (as refreshGameScene) will detect DATA is null
        // and reset the cube visuals, applying clueCubeBaseTexture if loaded.
        if (typeof refreshGameScene === 'function') {
            refreshGameScene(DATA);
            console.log("[Main.js] Game scene refreshed after clearing data.");
        } else {
            console.warn("[Main.js] refreshGameScene function not available after clearing data.");
        }
    });
    // Event listener for the "COPY JSON" button inside the modal
    if (copyJsonButton) {
        copyJsonButton.addEventListener('click', () => {
            const jsonDataString = jsonDataInput.value;
            if (jsonDataString) {
                navigator.clipboard.writeText(jsonDataString)
                    .then(() => {
                        updateStatus('JSON data copied to clipboard!', 'success-message');
                        console.log('[Main.js] JSON data copied to clipboard.');
                        // Optional: Temporarily change button text
                        const originalText = copyJsonButton.textContent;
                        copyJsonButton.textContent = 'COPIED!';
                        copyJsonButton.style.backgroundColor = '#28a745'; // Green
                        setTimeout(() => {
                            copyJsonButton.textContent = originalText;
                            copyJsonButton.style.backgroundColor = '#ffc107'; // Reset to original yellow
                        }, 2000);
                    })
                    .catch(err => {
                        updateStatus('Failed to copy JSON data. See console.', 'error-message');
                        console.error('[Main.js] Failed to copy JSON data: ', err);
                    });
            } else {
                updateStatus('Nothing to copy. The JSON input area is empty.', 'error-message');
            }
        });
    }
    // Set initial message for the tooltip (HTML handles initial display, JS can update if needed)
    // The main messageArea is now for dynamic feedback (success/error)
    messageArea.textContent = ''; // Clear initial text from the static p tag
    messageArea.className = ''; // Clear any initial classes
    // Event listener for file input change
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (selectedFileNameModal) selectedFileNameModal.textContent = `Selected: ${file.name}`;
                const reader = new FileReader();
                reader.onload = (e) => {
                    // Automatically process the loaded file data
                    // This overwrites the textarea content for immediate feedback and consistency
                    jsonDataInput.value = e.target.result;
                    processLoadedData(e.target.result, `file "${file.name}"`);
                    dataLoaderModal.classList.add('hidden'); // Close modal after loading
                };
                reader.onerror = (e) => {
                    updateStatus(`Error reading file "${file.name}": ${e.target.error}`, 'error-message');
                    console.error(`[Main.js] Error reading file:`, e.target.error);
                    if (selectedFileNameModal) selectedFileNameModal.textContent = 'Error loading file.';
                };
                reader.readAsText(file);
            } else {
                if (selectedFileNameModal) selectedFileNameModal.textContent = 'No file selected.';
            }
        });
    }
    
    // Auto-load the prefilled example data on startup so trivia works immediately
    if (jsonDataInput.value.trim()) {
        console.log('[Main.js] Auto-loading prefilled example data on startup');
        processLoadedData(jsonDataInput.value, "prefilled example");
    }
});
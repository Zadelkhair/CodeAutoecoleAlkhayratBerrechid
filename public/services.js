const services = {
    
    // Function to fetch all series
    getSeries: async function () {
        try {
            const response = await fetch('/series'); // Fetches from the '/series' endpoint
            if (!response.ok) {
                throw new Error('Failed to fetch series');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching series:', error);
        }
    },

    // Function to fetch a single series by its number
    getSeriesByNumber: async function (num) {
        try {
            const response = await fetch(`/series/${num}`); // Fetches from the '/series/:num' endpoint
            if (!response.ok) {
                throw new Error(`Failed to fetch series number ${num}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching series number ${num}:`, error);
        }
    },

    // Function to update a series by its number
    updateSeries: async function (num, updatedData) {
        try {
            const response = await fetch(`/series/${num}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData) // Send updated data as JSON
            });

            if (!response.ok) {
                throw new Error(`Failed to update series number ${num}`);
            }

            const data = await response.json();
            return data; // Response after successful update
        } catch (error) {
            console.error(`Error updating series number ${num}:`, error);
        }
    },

    // Function to create a new series
    createSeries: async function (newSeries) {
        try {
            const response = await fetch('/series', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newSeries) // Send the new series data
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create series');
            }

            const data = await response.json();
            return data; // The created series and success message
        } catch (error) {
            console.error('Error creating series:', error);
        }
    },

    uploadSeriesAssets: async function (imageFile, audioFile, audioExplanationFile) {
        try {
            const formData = new FormData();
    
            // Helper function to convert Blob or Blob URL to File
            const convertToFile = async (blobOrFile, defaultName, mimeType) => {
                try {
                    if (blobOrFile instanceof File) {
                        return blobOrFile; // Already a File
                    } else if (blobOrFile instanceof Blob) {
                        return new File([blobOrFile], defaultName, { type: mimeType }); // Convert Blob to File
                    } else if (typeof blobOrFile === 'string') {
                        // If it's a URL (possibly a Blob URL), fetch it
                        const response = await fetch(blobOrFile);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch from URL: ${blobOrFile}`);
                        }
                        const blob = await response.blob();
                        return new File([blob], defaultName, { type: mimeType }); // Convert fetched Blob to File
                    }
                } catch (error) {
                    console.error(`Error converting ${blobOrFile} to File:`, error);
                    return null;
                }
            };
    
            // Convert and append image file if valid
            if (imageFile) {
                const image = await convertToFile(imageFile, 'image.png', 'image/png');
                if (image) {
                    formData.append('image', image);
                } else {
                    console.warn('Image file is invalid and will not be uploaded.');
                }
            }
    
            // Convert and append audio file if valid
            if (audioFile) {
                const audio = await convertToFile(audioFile, 'audio.mp3', 'audio/mp3');
                if (audio) {
                    formData.append('audio', audio);
                } else {
                    console.warn('Audio file is invalid and will not be uploaded.');
                }
            }
    
            // Convert and append audio explanation file if valid
            if (audioExplanationFile) {
                const audioExplanation = await convertToFile(audioExplanationFile, 'audioExplanation.mp3', 'audio/mp3');
                if (audioExplanation) {
                    formData.append('audioExplanation', audioExplanation);
                } else {
                    console.warn('Audio explanation file is invalid and will not be uploaded.');
                }
            }
    
            // Check if formData is empty before making the request
            if (!formData.has('image') && !formData.has('audio') && !formData.has('audioExplanation')) {
                throw new Error('No valid files to upload');
            }
    
            console.log('FormData created:', {
                image: formData.get('image'),
                audio: formData.get('audio'),
                audioExplanation: formData.get('audioExplanation')
            });
    
            // Make the request to upload the files
            const response = await fetch('/question/assets/upload', {
                method: 'POST',
                body: formData // Send the FormData object with the files
            });
    
            if (!response.ok) {
                const errorMessage = await response.text();
                throw new Error(`Failed to upload series assets: ${errorMessage}`);
            }
    
            const data = await response.json();
            return data; // The paths of the uploaded files
        } catch (error) {
            console.error('Error uploading series assets:', error);
            throw error; // Re-throw the error for handling upstream
        }
    },

    // Function to delete a series by its number
    deleteSeries: async function (num) {
        try {
            const response = await fetch(`/series/${num}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete series number ${num}`);
            }

            const data = await response.json();
            return data; // Response after successful deletion
        } catch (error) {
            console.error(`Error deleting series number ${num}:`, error);
        }
    },

    // post sync-to-docs
    syncToDocs: async function () {
        try {
            const response = await fetch('/sync-to-docs', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to sync to docs');
            }

            const data = await response.json();
            return data; // Response after successful sync
        } catch (error) {
            console.error('Error syncing to docs:', error);
        }
    },

    // post /push-to-github
    pushToGithub: async function () {
        try {
            const response = await fetch('/push-to-github', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to push to GitHub');
            }

            const data = await response.json();
            return data; // Response after successful push
        } catch (error) {
            console.error('Error pushing to GitHub:', error);
        }
    }

};
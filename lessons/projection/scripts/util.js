async function loadShader(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load shader from ${url}.`);
        }
        return response.text();
    } catch (error) {
        throw new Error(`Error loading shader from ${url}: ${error.message}`);
    }
}

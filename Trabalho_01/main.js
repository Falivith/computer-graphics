function setModels() {
    return new Promise((resolve, reject) => {
        const models = [];
        const jsonFiles = ['./assets/json/building_A.json', './assets/json/building_B.json', './assets/json/building_C.json'];
        
        let counter = 0;

        jsonFiles.forEach((jsonFile, index) => {
            loadJSONResource(jsonFile, function (modelErr, modelObj) {
                counter++;
                if (modelErr) {
                    console.error('Fatal error getting model:', modelErr);
                    if (counter === jsonFiles.length) {
                        reject(new Error('Error loading models'));
                    }
                } else {
                    models[index] = modelObj;
                    if (counter === jsonFiles.length) {
                        resolve(models.filter(Boolean));
                    }
                }
            });
        });
    });
}

function init () {
    loadTextResource('./shaders/shaders.vs.glsl', function (vsErr, vsText) {
        if (vsErr) {
            alert('Fatal error getting vertex shader (see console)');
            console.error(vsErr);
        } else {
            loadTextResource('./shaders/shaders.fs.glsl', function (fsErr, fsText) {
                if (fsErr) {
                    alert('Fatal error getting fragment shader (see console)');
                    console.error(fsErr);
                } else {
                    loadJSONResource('./assets/json/building_A.json', function (modelErr, modelObj) {
                        if (modelErr) {
                            alert('Fatal error getting model (see console)');
                            console.error(fsErr);
                        } else {
                            loadImage('./assets/texture/citybits_texture.png', function (imgErr, img) {
                                if (imgErr) {
                                    alert('Fatal error getting texture (see console)');
                                    console.error(imgErr);
                                } else { 
                                    main(vsText, fsText, modelObj, img);
                                }
                            });
                        }
                    });
                }
            });
        }
    });
};

function main(vertexShader, fragmentShader, model, image) {

    /** @type {HTMLCanvasElement} */

    const canvas = document.getElementById('canvas');
	const gl = canvas.getContext('webgl');

    !gl? console.log('WebGL not supported, falling back on experimental-webgl'): null;

    const programInfo = webglUtils.createProgramInfo(gl, [vertexShader, fragmentShader]);
    
    function createElem(type, parent, className) {
        const elem = document.createElement(type);
        parent.appendChild(elem);
        if (className) {
          elem.className = className;
        }
        return elem;
    }

    const contentElem = document.querySelector('#content');

    let items = [];

    setModels()
    .then(models => {

        for (let i = 0; i < models.length; ++i) {
            const outerElem = createElem('div', contentElem, 'item');
            const viewElem = createElem('div', outerElem, 'view');
            const labelElem = createElem('div', outerElem, 'label');
            labelElem.textContent = `Item ${i + 1}`;

            
            let modelVertices = models[0].meshes[0].vertices;
            var modelIndices = [].concat.apply([], models[0].meshes[0].faces);
            var textureCoords = models[0].meshes[0].texturecoords[0];

            var modelPosBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, modelPosBufferObject);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelVertices), gl.STATIC_DRAW);
        
            var modelTexCoordBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, modelTexCoordBufferObject);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
        
            var modelIndexBufferObject = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, modelIndexBufferObject);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(modelIndices), gl.STATIC_DRAW);
        
            gl.bindBuffer(gl.ARRAY_BUFFER, modelPosBufferObject);
            var positionAttribLocation = gl.getAttribLocation(programInfo.program, 'vertPosition');
        
            gl.vertexAttribPointer(
                positionAttribLocation, // Attribute location
                3, // Number of elements per attribute
                gl.FLOAT, // Type of elements
                gl.FALSE,
                3 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
                0 // Offset from the beginning of a single vertex to this attribute
            );
            
            gl.enableVertexAttribArray(positionAttribLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, modelTexCoordBufferObject);
            var texCoordAttribLocation = gl.getAttribLocation(programInfo.program, 'vertTexCoord');
        
            gl.vertexAttribPointer(
                texCoordAttribLocation, // Attribute location
                2, // Number of elements per attribute
                gl.FLOAT, // Type of elements
                gl.FALSE,
                2 * Float32Array.BYTES_PER_ELEMENT, // Size of an individual vertex
                0
            );
        
            gl.enableVertexAttribArray(positionAttribLocation);
            gl.enableVertexAttribArray(texCoordAttribLocation);
        
            //
            // Create texture
            //
            var modelTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, modelTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE,
                image
            );
            gl.bindTexture(gl.TEXTURE_2D, null);

            items.push({
                modelInfo: 1, //Wrong
                color: [Math.random(), Math.random(), Math.random(), 1],
                element: viewElem
            });
        }
    })
    .catch(error => {
        console.error('Error loading models:', error);
    });

    console.log("Items: ", items);

    function degToRad(d) {
        return d * Math.PI / 180;
    }

    const fieldOfViewRadians = degToRad(60);

    function drawScene(projectionMatrix, cameraMatrix, worldMatrix, bufferInfo) {
        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
        // Make a view matrix from the camera matrix.
        const viewMatrix = m4.inverse(cameraMatrix);
    
        let mat = m4.multiply(projectionMatrix, viewMatrix);
        mat = m4.multiply(mat, worldMatrix);
    
        gl.useProgram(programInfo.program);
    
        // ------ Draw the bufferInfo --------
    
        // Setup all the needed attributes.
        webglUtils.setBuffersAndAttributes(gl, programInfo, bufferInfo);
    
        // Set the uniform
        webglUtils.setUniforms(programInfo, {
          u_matrix: mat,
        });
    
        webglUtils.drawBufferInfo(gl, bufferInfo);
      }

    function render(time) {
    time *= 0.001;  // convert to seconds
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);

    // move the canvas to top of the current scroll position
    gl.canvas.style.transform = `translateY(${window.scrollY}px)`;

        for (const {bufferInfo, element, color} of items) {
            const rect = element.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top  > gl.canvas.clientHeight ||
                rect.right  < 0 || rect.left > gl.canvas.clientWidth) {
            continue;  // it's off screen
            }

            const width  = rect.right - rect.left;
            const height = rect.bottom - rect.top;
            const left   = rect.left;
            const bottom = gl.canvas.clientHeight - rect.bottom;

            gl.viewport(left, bottom, width, height);
            gl.scissor(left, bottom, width, height);
            gl.clearColor(...color);

            const aspect = width / height;
            const near = 1;
            const far = 2000;

            // Compute a perspective projection matrix
            const perspectiveProjectionMatrix =
                m4.perspective(fieldOfViewRadians, aspect, near, far);

            // Compute the camera's matrix using look at.
            const cameraPosition = [0, 0, -2];
            const target = [0, 0, 0];
            const up = [0, 1, 0];
            const cameraMatrix = m4.lookAt(cameraPosition, target, up);

            // rotate the item
            const rTime = time * 0.2;
            const worldMatrix = m4.xRotate(m4.yRotation(rTime), rTime);

            drawScene(perspectiveProjectionMatrix, cameraMatrix, worldMatrix, bufferInfo);
        }
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

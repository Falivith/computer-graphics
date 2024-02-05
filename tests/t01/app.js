var vertexShaderText = [
    'precision mediump float;',
    '',
    'attribute vec2 vertPosition;',
    'attribute vec3 vertColor;',
    'varying vec3 fragColor;',
    '',
    'void main()',
    '{',
    '   fragColor = vertColor;',
    '   gl_Position = vec4(vertPosition, 0.0, 1.0);',
    '}'
].join('\n');

var fragmentShaderText = [
    'precision mediump float;',
    '',
    'varying vec3 fragColor;',
    'void main()',
    '{',
    '   gl_FragColor = vec4(fragColor, 1.0);',
    '}'
].join('\n');

let main = function () {

    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl.clearColor(0.3, 0.3, 0.7, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Criando Shaders
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vertexShaderText);
    gl.shaderSource(fragmentShader, fragmentShaderText);

    // Compilando Shaders
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
        return;
    }	
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
        return;
    }

    // Criando Programa
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("ERROR linking program!", gl.getProgramInfoLog(program));
        return;
    }

    // Validando (não sei exatamente o motivo disso, mas é bom fazer)
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.error("ERROR validating program!", gl.getProgramInfoLog(program));
        return;
    }

    var triangleVertices = [
        // X, Y,         R, G, B
        0.0,  0.5,     1.0, 1.0, 0.0,
       -0.5, -0.5,     0.7, 0.0, 1.0,
        0.5, -0.5,     0.1, 1.0, 0.6
    ];

    var triangleVertexBufferObject = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexBufferObject);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleVertices), gl.STATIC_DRAW);

    var positionAttribLocation = gl.getAttribLocation(program, 'vertPosition');
    var colorAttribLocation = gl.getAttribLocation(program, 'vertColor');
    gl.vertexAttribPointer(
        positionAttribLocation, // Atributo
        2, // Número de elementos por atributo
        gl.FLOAT, // Tipo de elementos
        gl.FALSE,
        5 * Float32Array.BYTES_PER_ELEMENT, // Tamanho do elemento
        0 // Offset
    );

    gl.vertexAttribPointer(
        colorAttribLocation, // Atributo
        3, // Número de elementos por atributo
        gl.FLOAT, // Tipo de elementos
        gl.FALSE,
        5 * Float32Array.BYTES_PER_ELEMENT, // Tamanho do elemento
        2 * Float32Array.BYTES_PER_ELEMENT // Offset
    );


    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(colorAttribLocation);
    // Main Render Loop

    gl.useProgram(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
};

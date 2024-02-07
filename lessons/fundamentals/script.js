async function main(){
    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl2");

    !gl?console.log("WebGL2 not supported"):console.log("Welcome to WebGL2");

    const vsText = await loadShader('./shaders/vs.glsl');
    const fsText = await loadShader('./shaders/fs.glsl');

    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vsText);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsText);

    var program = createProgram(gl, vertexShader, fragmentShader);

    // Procurar no programa os atributos e uniformes
    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    var resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    var colorLocation = gl.getUniformLocation(program, "u_color");
    
    var positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    var positions = [
        10, 20,
        80, 20,
        10, 30,
        10, 30,
        80, 20,
        80, 30,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Isso binda o buffer atual ao attribute
    gl.vertexAttribPointer(
        positionAttributeLocation,
        2,          // size
        gl.FLOAT,   // type
        false,      // normalize
        0,          // stride
        0,          // offset  
    );
    
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.5, 0.5, 0.5, 0.8)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program);
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);

    gl.bindVertexArray(vao);
    
    for (var ii = 0; ii < 50; ++ii) {
        // Setup a random rectangle
        setRectangle(
            gl, randomInt(300), randomInt(300), randomInt(300), randomInt(300));
     
        // Set a random color.
        gl.uniform4f(colorLocation, Math.random(), Math.random(), Math.random(), 1);
     
        // Draw the rectangle.
        var primitiveType = gl.TRIANGLES;
        var offset = 0;
        var count = 6;
        gl.drawArrays(primitiveType, offset, count);
      }
}

function main(){
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl");

    var program = gl.createProgram();
    var vShader = gl.createShader(gl.VERTEX_SHADER);
    var fShader = gl.createShader(gl.FRAGMENT_SHADER);
    var vShaderSource = document.getElementById("vertex-shader").text;
    var fShaderSource = document.getElementById("fragment-shader").text;

    gl.shaderSource(vShader, vShaderSource);
    gl.compileShader(vShader);

    gl.shaderSource(fShader, fShaderSource);
    gl.compileShader(fShader);

    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);

    gl.linkProgram(program);
    gl.useProgram(program);

   ////////////////////////////////
   
   var positionLocation = gl.getAttribLocation(program, "a_position");
   gl.enableVertexAttribArray(positionLocation);

   var buffer = gl.createBuffer();
   var vertices = [-0.5,  0.5,
                   -0.5, -0.5,
                    0.5,  0.5,
                    0.5,  0.5,
                    0.5,  0.5,
                   -0.5, -0.5,
                    0.5, -0.5];

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}


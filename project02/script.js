class scene {

}

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

var translation = [0, 0];
var width = 100;
var height = 30;
var color = [Math.random(), Math.random(), Math.random(), 1];

function drawScene() {
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
 
    // Diga a WebGL como converter do clip space para pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
 
    // Limpe a tela
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 
    // Diga para usar nosso programa (par de shaders)
    gl.useProgram(program);
 
    // Vincule o conjunto de atributos/buffers que queremos.
    gl.bindVertexArray(vao);
 
    // Passe na resolução da tela para que possamos converter de
    // pixels para clipspace no shader
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
 
    // Atualize o buffer de posição com posições do retângulo
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    setRectangle(gl, translation[0], translation[1], width, height);
 
    // Defina a cor.
    gl.uniform4fv(colorLocation, color);
 
    // Desenhe o retângulo.
    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = 6;
    gl.drawArrays(primitiveType, offset, count);
  }


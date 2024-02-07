async function main(){
    var canvas = document.querySelector("#canvas");
    var gl = canvas.getContext("webgl2");

    !gl?console.log("WebGL2 not supported"):console.log("Welcome to WebGL2");

    const vsText = await loadShader('./shaders/vs.glsl');
    const fsText = await loadShader('./shaders/fs.glsl');

    
}

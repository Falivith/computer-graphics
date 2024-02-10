async function loadAssets() {
  const directory = './assets/obj';

  return loadOBJandMTLFromDirectory(directory)
    .then(({ objResults, mtlResults }) => {
        return { objResults, mtlResults };
    })
    .catch(error => {
        throw new Error('Erro ao carregar arquivos: ' + error);
    });
}

async function main() {
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl2");
    !gl? console.log("WebGL2 not supported"): console.log("Welcome to WebGL2");

    twgl.setAttributePrefix("a_");

    const vsText = await loadShader('./shaders/vs.glsl');
    const fsText = await loadShader('./shaders/fs.glsl');

    const assets = await loadAssets();
    // Setup GLSL Program

    var meshProgramInfo = twgl.createProgramInfo(gl, [vsText, fsText]);

    const obj = assets.objResults[5];

    const baseHref = new URL('./assets/obj/', window.location.href);
    const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    }));
    const materials = parseMTL(matTexts.join('\n'));

    const textures = {
      defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
      defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
    };
    
    for (const material of Object.values(materials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith('Map'))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, baseHref).href;
            texture = twgl.createTexture(gl, {src: textureHref, flipY: true});
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }
  
    Object.values(materials).forEach(m => {
      m.shininess = 25;
      m.specular = [3, 2, 1];
    });

    const defaultMaterial = {
      diffuse: [1, 1, 1],
      diffuseMap: textures.defaultWhite,
      normalMap: textures.defaultNormal,
      ambient: [0, 0, 0],
      specular: [1, 1, 1],
      specularMap: textures.defaultWhite,
      shininess: 400,
      opacity: 1,
    };

    const parts = obj.geometries.map(({material, data}) => {
      // Because data is just named arrays like this
      //
      // {
      //   position: [...],
      //   texcoord: [...],
      //   normal: [...],
      // }
      //
      // and because those names match the attributes in our vertex
      // shader we can pass it directly into `createBufferInfoFromArrays`
      // from the article "less code more fun".
  
      if (data.color) {
        if (data.position.length === data.color.length) {
          // it's 3. The our helper library assumes 4 so we need
          // to tell it there are only 3.
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        // there are no vertex colors so just use constant white
        data.color = { value: [1, 1, 1, 1] };
      }
  
      // generate tangents if we have the data to do so.
      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        // There are no tangents
        data.tangent = { value: [1, 0, 0] };
      }
  
      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }
  
      if (!data.normal) {
        // we probably want to generate normals if there are none
        data.normal = { value: [0, 0, 1] };
      }
  
      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
      const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
      return {
        material: {
          ...defaultMaterial,
          ...materials[material],
        },
        bufferInfo,
        vao,
      };
    });

    const extents = getGeometriesExtents(obj.geometries);

    /*
      Renderização de Múltiplos Views
    */

    const settings = {
      rotation: 150,  // in degrees
    };

    webglLessonsUI.setupUI(document.querySelector("#ui"), settings, [
      { type: "slider",   key: "rotation",   min: 0, max: 360, change: render, precision: 2, step: 0.001, },
    ]);

    function updatePosition(index) {
      return function(event, ui) {
        translation[index] = ui.value;
        drawScene();
      };
    }
  
    function updateRotation(index) {
      return function(event, ui) {
        var angleInDegrees = ui.value;
        var angleInRadians = degToRad(angleInDegrees);
        rotation[index] = angleInRadians;
        drawScene();
      };
    }
  
    function updateScale(index) {
      return function(event, ui) {
        scale[index] = ui.value;
        drawScene();
      };
    }

    var translation = [45, 150, 0];
    var rotation = [degToRad(40), degToRad(25), degToRad(325)];
    var scale = [1, 1, 1];

    webglLessonsUI.setupSlider("#x",      {value: translation[0], slide: updatePosition(0), max: gl.canvas.width });
    webglLessonsUI.setupSlider("#y",      {value: translation[1], slide: updatePosition(1), max: gl.canvas.height});
    webglLessonsUI.setupSlider("#z",      {value: translation[2], slide: updatePosition(2), max: gl.canvas.height});
    webglLessonsUI.setupSlider("#angleX", {value: radToDeg(rotation[0]), slide: updateRotation(0), max: 360});
    webglLessonsUI.setupSlider("#angleY", {value: radToDeg(rotation[1]), slide: updateRotation(1), max: 360});
    webglLessonsUI.setupSlider("#angleZ", {value: radToDeg(rotation[2]), slide: updateRotation(2), max: 360});
    webglLessonsUI.setupSlider("#scaleX", {value: scale[0], slide: updateScale(0), min: -5, max: 5, step: 0.01, precision: 2});
    webglLessonsUI.setupSlider("#scaleY", {value: scale[1], slide: updateScale(1), min: -5, max: 5, step: 0.01, precision: 2});
    webglLessonsUI.setupSlider("#scaleZ", {value: scale[2], slide: updateScale(2), min: -5, max: 5, step: 0.01, precision: 2});

    function drawScene(projectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao) {
      // Clear the canvas AND the depth buffer.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
      // Make a view matrix from the camera matrix.
      const viewMatrix = m4.inverse(cameraMatrix);
  
      let mat = m4.multiply(projectionMatrix, viewMatrix);
      mat = m4.multiply(mat, worldMatrix);
  
      gl.useProgram(programInfo.program);

      gl.bindVertexArray(vao);
  
      twgl.setUniforms(programInfo, {
        u_world: worldMatrix,
        u_view: viewMatrix,
        u_projection: projectionMatrix,
      });
  
      twgl.drawBufferInfo(gl, bufferInfo);
    }
    console.log(parts);
  function render(time) {

    time *= 0.001; 

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);

    const fieldOfViewRadians = degToRad(60);

    // Dividir o Canvas
    const effectiveWidth = gl.canvas.clientWidth / 1;
    const aspect = effectiveWidth / gl.canvas.clientHeight;
    const zNear = 1;
    const zFar = 2000;

    // Compute a perspective projection matrix
    const perspectiveProjectionMatrix = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
    
    // Câmera ortográfica 
    const hhu = 120;
    const orthographicProjectionMatrix = m4.orthographic(-hhu * aspect, hhu * aspect, -hhu, hhu, -75, 2000);

    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraPosition = [0, 0, -3];

    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    // Câmera perspectiva
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, target, up);
    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    gl.useProgram(meshProgramInfo.program);

    // compute the world matrix once since all parts
    // are at the same space.

    var matrix = m4_extend.projection(gl.canvas.clientWidth, gl.canvas.clientHeight, 400);
    matrix = m4_extend.translate(matrix, translation[0], translation[1], translation[2]);
    matrix = m4_extend.xRotate(matrix, rotation[0]);
    matrix = m4_extend.yRotate(matrix, rotation[1]);
    matrix = m4_extend.zRotate(matrix, rotation[2]);
    matrix = m4_extend.scale(matrix, scale[0], scale[1], scale[2]);

    // Set the matrix.
    gl.uniformMatrix4fv(matrixLocation, false, matrix);

    let u_world = m4.yRotation(degToRad(settings.rotation));
    u_world = m4.translate(u_world, 0, -1, 0);

    for (const {bufferInfo, vao, material} of parts) {
      // set the attributes for this part.
      gl.bindVertexArray(vao);
      twgl.setUniforms(meshProgramInfo, {
        u_world,
      }, material);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // Set the uniforms
      twgl.setUniforms(meshProgramInfo, {
        u_lightDirection: m4.normalize([-1, 3, 5]),
        u_view: view,
        u_projection: projection,
        u_viewWorldPosition: cameraPosition,
      });
    
      // calls gl.drawArrays or gl.drawElements
      twgl.drawBufferInfo(gl, bufferInfo);
      //twgl.drawBufferInfo(gl, bufferInfo);
      //drawScene(gl, projection, camera, u_world, meshProgramInfo, bufferInfo);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

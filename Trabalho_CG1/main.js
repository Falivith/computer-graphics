"use strict";

const vs = `#version 300 es
in vec4 a_position;
in vec3 a_normal;

uniform mat4 u_matrix;

out vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the vertex normal as color to the fragment shader.
  v_color = vec4(a_normal * .5 + .5, 1);
}
`;

const fs = `#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

async function loadFiles(){
  const vsText = await loadShader('./shaders/vs.glsl');
  const fsText = await loadShader('./shaders/fs.glsl');
  const assets = await loadAssets('./assets/obj');

  const models = {
    objects: assets.objResults,
    texture: assets.mtlResults[0]
  }

  console.log(models);

  main(models);
}

function main(models) {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  // setup GLSL programs
  // compiles shaders, links program, looks up locations
  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  // Tell the twgl to match position with a_position,
  // normal with a_normal etc..
  twgl.setAttributePrefix("a_");

  // create buffers and fill with data for various things.
  let bufferInfosAndVAOs = [
    twgl.primitives.createCubeBufferInfo(
        gl,
        1,  // width
        1,  // height
        1,  // depth
    ),
  ].map((bufferInfo) => {
    return {
      bufferInfo,
      vao: twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo),
    };
  });

  console.log('Antes do Buffer:', twgl.primitives.createCubeBufferInfo(gl,1,1, ),);
  console.log('Funciona:', bufferInfosAndVAOs);
  console.log('Antes do Buffer:', models.objects[5].geometries[0]);

  bufferInfosAndVAOs = models.objects[5].geometries.map(({data}) => {
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

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);
    return {
      material: {
        u_diffuse: [1, 1, 1, 1],
      },
      bufferInfo,
      vao,
    };
  });

  function createElem(type, parent, className) {
    const elem = document.createElement(type);
    parent.appendChild(elem);
    if (className) {
      elem.className = className;
    }
    return elem;
  }

  function randArrayElement(array) {
    return array[Math.random() * array.length | 0];
  }

  function rand(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const contentElem = document.querySelector('#right_bar');
  const items = [];
  const numItems = 4;

  for (let i = 0; i < numItems; ++i) {
    
    const outerElem = createElem('div', contentElem, 'item');
    const viewElem = createElem('div', outerElem, 'view');
    const labelElem = createElem('div', outerElem, 'label');
    labelElem.textContent = `Item ${i + 1}`;

    const {bufferInfo, vao} = randArrayElement(bufferInfosAndVAOs);
    const color = [rand(1), rand(1), rand(1), 1];
    items.push({
      bufferInfo,
      vao,
      color,
      element: viewElem,
    });
  }

  const fieldOfViewRadians = degToRad(60);

  function drawScene(projectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao) {
    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Make a view matrix from the camera matrix.
    const viewMatrix = m4.inverse(cameraMatrix);

    let mat = m4.multiply(projectionMatrix, viewMatrix);
    mat = m4.multiply(mat, worldMatrix);

    gl.useProgram(programInfo.program);

    // ------ Draw the bufferInfo --------

    // Setup all the needed attributes.
    gl.bindVertexArray(vao);

    // Set the uniform
    twgl.setUniforms(programInfo, {
      u_matrix: mat,
    });

    // calls gl.drawArrays or gl.drawElements
    twgl.drawBufferInfo(gl, bufferInfo);
  }

  function render(time) {
    time *= 0.001;  // convert to seconds

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);

    // move the canvas to top of the current scroll position
    gl.canvas.style.transform = `translateY(${window.scrollY}px)`;

    for (const {bufferInfo, vao, element, color} of items) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top  > gl.canvas.clientHeight ||
          rect.right  < 0 || rect.left > gl.canvas.clientWidth) {
        continue;  // it's off screen
      }

      const width  = rect.right - rect.left;
      const height = rect.bottom - rect.top;
      const left   = rect.left;
      const bottom = gl.canvas.clientHeight - rect.bottom - 1;

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
      const cameraPosition = [0, 0, -3];
      const target = [0, 0, 0];
      const up = [0, 1, 0];
      const cameraMatrix = m4.lookAt(cameraPosition, target, up);

      // rotate the item
      const rTime = time * 0.2;
      const worldMatrix = m4.xRotate(m4.yRotation(rTime), rTime);

      drawScene(perspectiveProjectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

loadFiles();

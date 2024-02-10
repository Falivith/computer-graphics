"use strict";

const vs = `#version 300 es
in vec4 a_position; // Coordenadas do Modelo
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_texcoord;
in vec4 a_color;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform vec3 u_viewWorldPosition;

out vec3 v_normal;
out vec3 v_tangent;
out vec3 v_surfaceToView;
out vec2 v_texcoord;
out vec4 v_color;

void main() {
  vec4 worldPosition = u_world * a_position;
  gl_Position = u_projection * u_view * worldPosition;
  v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

  mat3 normalMat = mat3(u_world);
  v_normal = normalize(normalMat * a_normal);
  v_tangent = normalize(normalMat * a_tangent);

  v_texcoord = a_texcoord;
  v_color = a_color;
}
`

const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_tangent;
in vec3 v_surfaceToView;
in vec2 v_texcoord;
in vec4 v_color;

uniform vec3 diffuse;
uniform sampler2D diffuseMap;
uniform vec3 ambient;
uniform vec3 emissive;
uniform vec3 specular;
uniform sampler2D specularMap;
uniform float shininess;
uniform sampler2D normalMap;
uniform float opacity;
uniform vec3 u_lightDirection;
uniform vec3 u_ambientLight;

out vec4 outColor;

void main () {
  vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
  vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
  vec3 bitangent = normalize(cross(normal, tangent));

  mat3 tbn = mat3(tangent, bitangent, normal);
  normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
  normal = normalize(tbn * normal);

  vec3 surfaceToViewDirection = normalize(v_surfaceToView);
  vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

  float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
  float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
  vec4 specularMapColor = texture(specularMap, v_texcoord);
  vec3 effectiveSpecular = specular * specularMapColor.rgb;

  vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
  vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
  float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

  outColor = vec4(
      emissive +
      ambient * u_ambientLight +
      effectiveDiffuse * fakeLight +
      effectiveSpecular * pow(specularLight, shininess),
      effectiveOpacity);
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

async function main(models) {
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

  const actualObj = models.objects[7];

  const textures = {
    defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
    defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
  };

  const baseHref = new URL('./assets/obj/', window.location.href);
  const matTexts = await Promise.all(actualObj.materialLibs.map(async filename => {
    const matHref = new URL(filename, baseHref).href;
    const response = await fetch(matHref);
    return await response.text();
  }));
  const materials = parseMTL(matTexts.join('\n'));

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

  const bufferInfosAndVAOs = models.objects[7].geometries.map(({material, data, object}) => {
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

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);

    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
      vao,
      name: object
    };
  });

  console.log(bufferInfosAndVAOs);

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

    const {bufferInfo, vao, material, name} = randArrayElement(bufferInfosAndVAOs);
    labelElem.textContent = name;
    const color = [rand(0.5), 0.2, 0.2, 0.4];
    items.push({
      bufferInfo,
      vao,
      color,
      material,
      element: viewElem,
    });
  }

  const fieldOfViewRadians = degToRad(60);

  const settings = {
    rotation: 150,
  };

  webglLessonsUI.setupUI(document.querySelector("#ui"), settings, [
    { type: "slider",   key: "rotation",   min: 0, max: 360, change: render, precision: 2, step: 0.001, },
  ]);

  function drawScene(projectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao, texture) {
    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Make a view matrix from the camera matrix.
    const viewMatrix = m4.inverse(cameraMatrix);


    gl.useProgram(programInfo.program);

    // ------ Draw the bufferInfo --------

    // Setup all the needed attributes.
    gl.bindVertexArray(vao);
    // Set the uniform
    twgl.setUniforms(programInfo, {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_world: worldMatrix,
      u_view: viewMatrix,
      u_projection: projectionMatrix,
    }, texture);

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

    let u_world = m4.yRotation(degToRad(50));
    u_world = m4.translate(u_world, 0, -1, 0);

    for (const {bufferInfo, vao, element, material, color} of items) {

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
      const cameraPosition = [0, 2, -3];
      const target = [0, 0.5, 0];
      const up = [0, 1, 0];
      const cameraMatrix = m4.lookAt(cameraPosition, target, up);

      // rotate the item
      const rTime = time * 0.2;
      const worldMatrix = (m4.yRotation(rTime));

      drawScene(perspectiveProjectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao, material);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

loadFiles();

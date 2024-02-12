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

uniform vec4 u_id;


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
  const assets = await loadAssets('./assets/obj');

  const models = {
    objects: assets.objResults,
    texture: assets.mtlResults[0]
  }

  main(models);
}

async function main(models) {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");

  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  twgl.setAttributePrefix("a_");

  const textures = {
    defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
    defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
  };

  const baseHref = new URL('./assets/obj/', window.location.href);
  const matTexts = await Promise.all(models.objects[0].materialLibs.map(async filename => {
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
    m.shininess = 15;
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

  let bufferInfosAndVAOs = [];

  Object.keys(models.objects).forEach(key => {
    const geometries = models.objects[key].geometries;
  
    geometries.forEach(({ material, data, object }) => {
      if (data.color && data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      } else {
        data.color = { value: [1, 1, 1] };
      }
  
      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        data.tangent = { value: [1, 0, 0] };
      }

      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }
  
      if (!data.normal) {
        data.normal = { value: [0, 0, 1] };
      }
  
      const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
      const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);
  
      bufferInfosAndVAOs.push({
        material: {
          ...defaultMaterial,
          ...materials[material],
        },
        bufferInfo,
        vao,
        name: object,
        geometries
      });
    });
  });

  function createElem(type, parent, className) {
    const elem = document.createElement(type);
    parent.appendChild(elem);
    if (className) {
      elem.className = className;
    }
    return elem;
  }

  var mainSceneObjects = [];
  var idCounter = 0;

  const contentElem = document.querySelector('#right_bar');
  let items = [];
  const numItems = 60;

  for (let i = 5; i < numItems; ++i) {

    const {bufferInfo, vao, material, name, geometries} = bufferInfosAndVAOs[i];

    const outerElem = createElem('div', contentElem, 'item_from_list');
    const viewElem = createElem('div', outerElem, 'view_from_list');

    viewElem.onclick = function() {
      
      const viewElem = document.getElementById("sceneView")      
      mainSceneObjects = pickModelFromMenu(name, bufferInfosAndVAOs);
      const index = mainSceneObjects.index;

      items.push({
        id: idCounter++,
        name: bufferInfosAndVAOs[index].name,
        bufferInfo: bufferInfosAndVAOs[index].bufferInfo,
        vao: bufferInfosAndVAOs[index].vao,
        color: [0.1, 0.1, 0.3, 0.1],
        material: bufferInfosAndVAOs[index].material,
        element: viewElem,
        geometries: bufferInfosAndVAOs[index].geometries,
        focused: true,
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });

      updateItems(items);
      updateListeners();
    };

    const labelElem = createElem('div', outerElem, 'label');

    labelElem.textContent = name;

    const color = [1, 0.2, 0.2, 0.4];
    items.push({
      name,
      bufferInfo,
      vao,
      color,
      material,
      element: viewElem,
      geometries,
    });
  }

  const fieldOfViewRadians = degToRad(60);

  var translation = [0, 0, 0];
  var rotation = [0, 0, 0];
  var scale = [1, 1, 1];

  var camera = [0, 0, 0];
  var cameraRotation = [0, 0, 0];

  webglLessonsUI.setupSlider("#x", {value: translation[0], slide: updatePosition(0), min: -5, max: +5, step: 0.1, precision: 2});
  webglLessonsUI.setupSlider("#y", {value: translation[1], slide: updatePosition(1), min: -5, max: +5, step: 0.1, precision: 2});
  webglLessonsUI.setupSlider("#z", {value: translation[2], slide: updatePosition(2), min: -5, max: +5, step: 0.1, precision: 2});

  webglLessonsUI.setupSlider("#angleX", {value: rotation[0], slide: updateRotation(0), max: 360});
  webglLessonsUI.setupSlider("#angleY", {value: rotation[1], slide: updateRotation(1),   max: 360});
  webglLessonsUI.setupSlider("#angleZ", {value: rotation[2], slide: updateRotation(2),  max: 360});

  webglLessonsUI.setupSlider("#scaleX", {value: scale[0], slide: updateScale(0), min: -5, max: 5, step: 0.01, precision: 2});
  webglLessonsUI.setupSlider("#scaleY", {value: scale[1], slide: updateScale(1), min: -5, max: 5, step: 0.01, precision: 2});
  webglLessonsUI.setupSlider("#scaleZ", {value: scale[2], slide: updateScale(2), min: -5, max: 5, step: 0.01, precision: 2});

  webglLessonsUI.setupSlider("#cameraX", {value: camera[0], slide: updateCamera(0), min: -5, max: 5, step: 0.01, precision: 2});
  webglLessonsUI.setupSlider("#cameraY", {value: camera[1], slide: updateCamera(1), min: -5, max: 5, step: 0.01, precision: 2});
  webglLessonsUI.setupSlider("#cameraZ", {value: camera[2], slide: updateCamera(2), min: -5, max: 5, step: 0.01, precision: 2});

  webglLessonsUI.setupSlider("#cameraAngleX", {value: cameraRotation[0], slide: updateCameraRotation(0), max: 360});
  webglLessonsUI.setupSlider("#cameraAngleY", {value: cameraRotation[1], slide: updateCameraRotation(1), max: 360});
  webglLessonsUI.setupSlider("#cameraAngleZ", {value: cameraRotation[2], slide: updateCameraRotation(2), max: 360});

  function updatePosition(index) {
    return function(event, ui) {
        const selectedItem = items.find(item => item.id == selected);

        if (selectedItem) {
            selectedItem.translation[index] = ui.value;
        }
    };
  }

  function updateRotation(index) {
    return function(event, ui) {
        const angleInDegrees = ui.value;
        const angleInRadians = angleInDegrees * Math.PI / 180;

        const selectedItem = items.find(item => item.id == selected);

        if (selectedItem) {
            selectedItem.rotation[index] = angleInRadians;
        }
    };
  }

  function updateScale(index) {
      return function(event, ui) {
          const selectedItem = items.find(item => item.id == selected);

          if (selectedItem) {
              selectedItem.scale[index] = ui.value;
          }
      };
  }

  function updateCamera(index) {
    return function(event, ui) {
      camera[index] = ui.value;
    };
  }

  function updateCameraRotation(index) {
    return function(event, ui) {
      const angleInDegrees = ui.value;
      const angleInRadians = angleInDegrees * Math.PI / 180;
  
      cameraRotation[index] = angleInRadians;
    };
  }

  const exportButton = document.getElementById('exportScene');
  exportButton.onclick = function() {
    exportState();
  };

  let imported = false;

  function exportState(){
    const json = convertToJSON(items);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
  }

  document.getElementById('fileChooser').addEventListener('change', function(event) {
    items = [];
    const file = event.target.files[0];
      if (file) {
          handleFile(file, function(data) {
              items = data;
              console.log(data);
          });
      }
    });

  function drawScene(projectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao, texture, focused) {

    if(!focused){
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    const viewMatrix = m4.inverse(cameraMatrix);

    gl.useProgram(programInfo.program);
    gl.bindVertexArray(vao);
    twgl.setUniforms(programInfo, {
      u_lightDirection: m4.normalize([-1, 4, 5]),
      u_world: worldMatrix,
      u_view: viewMatrix,
      u_projection: projectionMatrix,
    }, texture);

    twgl.drawBufferInfo(gl, bufferInfo);
  }

  function render(time) {

    time *= 0.001;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);

    // move the canvas to top of the current scroll position
    gl.canvas.style.transform = `translateY(${window.scrollY}px)`;

    for (const {
       bufferInfo,
       vao, 
       element, 
       material, 
       color, 
       geometries,
       focused, 
       translation,
       rotation,
       scale
      } of items) {

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

      const extents = getGeometriesExtents(geometries);
      const range = m4.subtractVectors(extents.max, extents.min);
      const objOffset = m4.scaleVector(
          m4.addVectors(
            extents.min,
            m4.scaleVector(range, 0.5)),
          -1);
      const cameraTarget = [0, 1, 0];
      const radius = m4.length(range) * 1.1;
      const cameraPosition = m4.addVectors(cameraTarget, [
        0,
        1.2,
        radius,
      ]);
      const near = radius / 100;
      const far = radius * 3;

      const aspect = width / height;
      const perspectiveProjectionMatrix =
          m4.perspective(fieldOfViewRadians, aspect, near, far);

      const target = [0, 0, 0];
      const up = [0, 1, 0];
      let cameraMatrix = m4.lookAt(cameraPosition, target, up);

      const rTime = time * 0.7;
      
      let worldMatrix = m4.identity();

      if(!focused){
        worldMatrix = (m4.yRotation(rTime));
        worldMatrix = m4.translate(worldMatrix, ...objOffset);       
      }

      if(focused){
        worldMatrix = m4.translate(worldMatrix, ...translation)
        worldMatrix = m4.xRotate(worldMatrix, rotation[0])
        worldMatrix = m4.yRotate(worldMatrix, rotation[1])
        worldMatrix = m4.zRotate(worldMatrix, rotation[2])
        worldMatrix = m4.scale(worldMatrix, scale[0], scale[1], scale[2])
        cameraMatrix = m4.translate(cameraMatrix, camera[0], camera[1], camera[2]);
        cameraMatrix = m4.xRotate(cameraMatrix, cameraRotation[0]);
        cameraMatrix = m4.yRotate(cameraMatrix, cameraRotation[1]);
        cameraMatrix = m4.zRotate(cameraMatrix, cameraRotation[2]);    
      }
      drawScene(perspectiveProjectionMatrix, cameraMatrix, worldMatrix, bufferInfo, vao, material, focused);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

loadFiles();

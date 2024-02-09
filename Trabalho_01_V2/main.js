async function main() {
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl2");
    !gl? console.log("WebGL2 not supported"): console.log("Welcome to WebGL2");

    twgl.setAttributePrefix("a_");

    const vsText = await loadShader('./shaders/vs.glsl');
    const fsText = await loadShader('./shaders/fs.glsl');

    // Setup GLSL Program

    var meshProgramInfo = twgl.createProgramInfo(gl, [vsText, fsText]);

    const response = await fetch('./assets/obj/building_B.obj')
    const text = await response.text()
    const obj = parseOBJ(text)

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
    const range = m4.subtractVectors(extents.max, extents.min);
    // amount to move the object so its center is at the origin
    const objOffset = m4.scaleVector(
        m4.addVectors(
          extents.min,
          m4.scaleVector(range, 0.5)),
        -1);

    const cameraTarget = [0, 0, 3];
    // figure out how far away to move the camera so we can likely
    // see the object.
    const radius = m4.length(range) * 0.5;

    const cameraPosition = m4.addVectors(cameraTarget, [
      0,
      0,
      radius,
    ]);
    // Set zNear and zFar to something hopefully appropriate
    // for the size of this object.
    const zNear = radius / 100;
    const zFar = radius * 8;

    const up = [0, 1, 0];

    console.log(m4.inverse(m4.lookAt(cameraPosition, cameraTarget, up)), m4.lookAt(cameraPosition, cameraTarget, up));
    
  function render(time) {
    time *= 0.001;  // convert to seconds

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };



    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    twgl.setUniforms(meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.
    let u_world = m4.yRotation(time);
    u_world = m4.translate(u_world, ...objOffset);

    for (const {bufferInfo, vao, material} of parts) {
      // set the attributes for this part.
      gl.bindVertexArray(vao);
      twgl.setUniforms(meshProgramInfo, {
        u_world,
      }, material);
      twgl.drawBufferInfo(gl, bufferInfo);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

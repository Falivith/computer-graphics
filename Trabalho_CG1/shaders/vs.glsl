#version 300 es
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
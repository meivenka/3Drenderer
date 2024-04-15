
precision mediump float;

struct Light
{
  bool is_directional;
  float intensity;
  vec4 color;
  vec3 direction;
};

varying vec4 v_position;
varying vec4 v_normal;
varying vec3 v_texture_coord;

uniform mat4 persp_matrix_inv;
uniform mat4 camera_normal_matrix;

#define MAX_LIGHTS 20

uniform Light lights[MAX_LIGHTS];
uniform int nlights;

void main()
{
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  for (int li = 0; li < MAX_LIGHTS; li++) {
    if (li >= nlights) {
      break;
    }
    Light light = lights[li];
    if (light.is_directional) {
    } else {
      float material_ka = 0.3;
      vec4 dcolor_ambient = light.intensity * material_ka * light.color;
      color += dcolor_ambient;
    }
  }
  gl_FragColor = color;
}

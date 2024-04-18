
precision mediump float;

struct Light
{
  bool is_directional;
  float intensity;
  vec3 color;
  vec3 direction;
};

varying vec4 v_position;
varying vec4 v_normal;
varying vec3 v_texture_coord;

uniform mat4 persp_matrix_inv;
uniform mat4 camera_normal_matrix;

#define MAX_LIGHTS 20

uniform Light lights[MAX_LIGHTS];
uniform int n_lights;

vec3 vec4_to_vec3(vec4 v)
{
  return vec3(v[0] / v[3], v[1] / v[3], v[2] / v[3]);
}

void main()
{
  vec3 color = vec3(0.0, 0.0, 0.0);

  for (int li = 0; li < MAX_LIGHTS; li++) {
    if (li >= n_lights) {
      break;
    }
    Light light = lights[li];
    if (light.is_directional) {
      float material_n = 10.0;
      float material_ks = 0.7;
      vec3 material_color = vec3(1.0, 0.5, 0.5);
      vec3 E = normalize(-vec4_to_vec3(v_position * persp_matrix_inv));
      vec3 N = normalize(vec4_to_vec3(v_normal));
      vec3 L = normalize(vec4_to_vec3(vec4(-light.direction, 1.0) * camera_normal_matrix));
      vec3 R = normalize(2.0 * max(dot(L, N), 0.0) * N - L);
      vec3 dcolor_specular = light.intensity * pow(max(dot(R, E), 0.0), material_n) * material_ks * light.color;

      vec3 dcolor_diffuse = light.intensity * max(dot(N, L), 0.0) * material_color * light.color;
      
      color += dcolor_specular + dcolor_diffuse;
    } else {
      float material_ka = 0.3;
      vec3 dcolor_ambient = light.intensity * material_ka * light.color;
      color += dcolor_ambient;
    }
  }
  gl_FragColor = vec4(color, 1.0);
}

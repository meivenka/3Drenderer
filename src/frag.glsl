
precision mediump float;

struct Light
{
  bool is_directional;
  float intensity;
  vec3 color;
  vec3 direction;
};

struct Material
{
  vec3 ka, kd, ks;
  float n;
};

varying vec4 v_position;
varying vec4 v_normal;
varying vec4 v_texture_coord;

uniform mat4 persp_matrix_inv;
uniform mat4 camera_normal_matrix;

#define MAX_LIGHTS 20

uniform Light lights[MAX_LIGHTS];
uniform int n_lights;
uniform Material material;
uniform bool with_ka_texture;
uniform sampler2D ka_texture;
uniform bool with_kd_texture;
uniform sampler2D kd_texture;
uniform bool with_ks_texture;
uniform sampler2D ks_texture;

vec3 vec4_to_vec3(vec4 v)
{
  return v.xyz / v.w;
}

vec3 get_texture_color(sampler2D sampler)
{
  vec3 texture_coord = v_position.z * vec4_to_vec3(v_texture_coord);
  return texture2D(sampler, texture_coord.xy).xyz;
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
      vec3 E = normalize(-vec4_to_vec3(v_position * persp_matrix_inv));
      vec3 N = normalize(vec4_to_vec3(v_normal));
      vec3 L = normalize(vec4_to_vec3(vec4(-light.direction, 1.0) * camera_normal_matrix));
      vec3 R = normalize(2.0 * max(dot(L, N), 0.0) * N - L);
      vec3 ks_texture_color = vec3(1.0, 1.0, 1.0);
      if (with_ks_texture) {
        ks_texture_color = get_texture_color(ks_texture);
      }
      vec3 dcolor_specular = light.intensity * pow(max(dot(R, E), 0.0), material.n) * material.ks * ks_texture_color * light.color;

      vec3 kd_texture_color = vec3(1.0, 1.0, 1.0);
      if (with_kd_texture) {
        kd_texture_color = get_texture_color(kd_texture);
      }
      vec3 dcolor_diffuse = light.intensity * max(dot(N, L), 0.0) * material.kd * kd_texture_color * light.color;
      
      color += dcolor_specular + dcolor_diffuse;
    } else {
      vec3 texture_color = vec3(1.0, 1.0, 1.0);
      if (with_ka_texture) {
        texture_color = get_texture_color(ka_texture);
      }
      vec3 dcolor_ambient = light.intensity * material.ka * light.color * texture_color;
      color += dcolor_ambient;
    }
  }
    
  gl_FragColor = vec4(color, 1.0);
}

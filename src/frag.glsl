
precision mediump float;

struct Light
{
  bool is_directional;
  float intensity;
  vec3 color;
  vec3 direction;
  vec3 source;
};

struct Material
{
  vec3 ka, kd, ks;
  float n;
  bool with_ka_texture;
  sampler2D ka_texture;
  bool with_kd_texture;
  sampler2D kd_texture;
  bool with_ks_texture;
  sampler2D ks_texture;

  bool is_procedural_texture;
  float tex_seed;
  bool is_tex_perlin;
  float tex_nwidth;
  float tex_nheight;
  vec3 tex_background;
  vec3 tex_color;
};

varying vec4 v_position;
varying vec4 v_normal;
varying vec4 v_texture_coord;
varying float v_material_index;

uniform mat4 persp_matrix_inv;
uniform mat4 camera_normal_matrix;

#define MAX_LIGHTS 20
#define MAX_MATERIALS 20

uniform Light lights[MAX_LIGHTS];
uniform int n_lights;
uniform Material material;

vec2 perlin_gradient(vec2 xy, float seed)
{
  float rand = fract(sin(dot(xy ,vec2(12.9898,78.233))) * (43758.5453 * seed)) * 2.0 * 3.1416;
  return vec2(sin(rand), cos(rand));
}

float perlin_product(vec2 gxy, vec2 grid, float seed)
{
  vec2 d = vec2(gxy.x - grid.x, gxy.y - grid.y);
  vec2 gradient = perlin_gradient(grid, seed);
  return dot(d, gradient);
}

float perlin_noise(float nwidth, float nheight, float seed, vec2 xy)
{
  float gx = xy.x * nwidth;
  float gy = xy.y * nheight;
  float gx0 = floor(gx);
  float gy0 = floor(gy);
  float gx1 = gx0 + 1.0;
  float gy1 = gy0 + 1.0;

  vec2 gxy = vec2(gx, gy);

  float p00 = perlin_product(gxy, vec2(gx0, gy0), seed);
  float p01 = perlin_product(gxy, vec2(gx0, gy1), seed);
  float p10 = perlin_product(gxy, vec2(gx1, gy0), seed);
  float p11 = perlin_product(gxy, vec2(gx1, gy1), seed);

  float p0 = p00 * (gy1 - gy) + p01 * (gy - gy0);
  float p1 = p10 * (gy1 - gy) + p11 * (gy - gy0);

  float p = p0 * (gx1 - gx) + p1 * (gx - gx0);

  return p * 0.5 + 0.5;
}

int float2int(float f)
{
  return int(f + 0.5);
}

vec3 vec4_to_vec3(vec4 v)
{
  return v.xyz / v.w;
}

vec3 get_texture_color(sampler2D sampler)
{
  vec3 texture_coord = v_position.z * vec4_to_vec3(v_texture_coord);
  return texture2D(sampler, texture_coord.xy).xyz;
}

vec3 get_procedural_color(Material material)
{
  vec3 texture_coord = v_position.z * vec4_to_vec3(v_texture_coord);
  
  if (material.is_tex_perlin) {
    float noise = perlin_noise(material.tex_nwidth, material.tex_nheight, material.tex_seed, texture_coord.xy);
    return noise * material.tex_color + (1.0 - noise) * material.tex_background;
  }

  return vec3(1.0, 1.0, 1.0);
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
      vec3 pos = vec4_to_vec3(v_position * persp_matrix_inv);
      vec3 E = normalize(-pos);
      vec3 N = normalize(vec4_to_vec3(v_normal));
      vec3 L = normalize(light.source - pos);
      vec3 R = normalize(2.0 * max(dot(L, N), 0.0) * N - L);
      vec3 ks_texture_color = vec3(1.0, 1.0, 1.0);
      if (material.with_ks_texture) {
        ks_texture_color = get_texture_color(material.ks_texture);
      }
      vec3 dcolor_specular = light.intensity * pow(max(dot(R, E), 0.0), material.n) * material.ks * ks_texture_color * light.color;

      vec3 kd_texture_color = vec3(1.0, 1.0, 1.0);
      if (material.with_kd_texture) {
        kd_texture_color = get_texture_color(material.kd_texture);
      }
      vec3 dcolor_diffuse = light.intensity * max(dot(N, L), 0.0) * material.kd * kd_texture_color * light.color;
      
      color += dcolor_specular + dcolor_diffuse;
    } else {
      vec3 texture_color = vec3(1.0, 1.0, 1.0);
      if (material.is_procedural_texture) {
        texture_color = get_procedural_color(material);
      } else if (material.with_ka_texture) {
        texture_color = get_texture_color(material.ka_texture);
      }
      vec3 dcolor_ambient = light.intensity * material.ka * light.color * texture_color;
      color += dcolor_ambient;
    }
  }
    
  gl_FragColor = vec4(color, 1.0);
}

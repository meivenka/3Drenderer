attribute vec3 position;
attribute vec3 normal;
attribute vec3 texture_coord;

varying vec4 v_position;
varying vec4 v_normal;
varying vec3 v_texture_coord;

uniform mat4 trans_matrix;
uniform mat4 normal_matrix;

void main()
{
  v_position = vec4(position, 1.0);
  v_position = v_position * trans_matrix;
  gl_Position = v_position;
  v_normal = vec4(normal, 1.0);
  v_normal = v_normal * normal_matrix;
  v_texture_coord = texture_coord;
}

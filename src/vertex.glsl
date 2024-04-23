attribute vec3 position;
attribute vec3 normal;
attribute vec3 texture_coord;

varying vec4 v_position_world;
varying vec4 v_position_camera;
varying vec4 v_normal_world;
varying vec4 v_texture_coord;

uniform mat4 world_matrix;
uniform mat4 world_matrix_inv_transpose;
uniform mat4 camera_matrix;
uniform mat4 persp_matrix;

void main()
{
  v_position_world = vec4(position, 1.0);
  v_position_world = v_position_world * world_matrix;
  v_position_camera = v_position_world * camera_matrix;
  gl_Position = v_position_camera * persp_matrix;
  v_normal_world = vec4(normal, 1.0);
  v_normal_world = v_normal_world * world_matrix_inv_transpose;
  v_texture_coord = vec4(texture_coord, v_position_camera.z / v_position_camera.w);
}

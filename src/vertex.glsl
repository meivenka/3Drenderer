attribute vec3 position;
attribute vec3 normal;
attribute vec3 texture_coord;

varying vec4 v_position;
varying vec4 v_normal;
varying vec3 v_texture_coord;

void main()
{
  gl_Position = vec4(position, 1.0);
  v_position = vec4(position, 1.0);
  v_normal = vec4(normal, 1.0);
  v_texture_coord = texture_coord;
}

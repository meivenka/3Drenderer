
precision mediump float;

varying vec4 v_position;
varying vec4 v_normal;
varying vec3 v_texture_coord;

void main()
{
  gl_FragColor = vec4(v_texture_coord, 1.0);
}

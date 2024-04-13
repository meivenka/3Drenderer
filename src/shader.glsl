#version 330 core

// Input vertex data from the vertex shader
in vec2 TexCoord; // Texture coordinates from the vertex shader

// Output data
out vec4 FragColor; // Final color output

// Texture sampler
uniform sampler2D textureSampler; // Texture sampler uniform

void main()
{
  // Sample the texture at the specified texture coordinate
  vec4 texColor = texture(textureSampler, TexCoord);
    
  // Output the color to the framebuffer
  FragColor = texColor;
}

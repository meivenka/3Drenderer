import numpy as np
import matplotlib.pyplot as plt

def mandelbrot(c, max_iters=256, escape_radius=2):
    z = 0
    for n in range(max_iters):
        if abs(z) > escape_radius:
            return n
        z = z * z + c
    return max_iters

width, height = 1024, 1024
re_min, re_max = -2.0, 1.0
im_min, im_max = -1.5, 1.5

real = np.linspace(re_min, re_max, width)
imag = np.linspace(im_min, im_max, height)
real_axis, imag_axis = np.meshgrid(real, imag)
complex_grid = real_axis + 1j * imag_axis

vectorized_mandelbrot = np.vectorize(mandelbrot)
fractal = vectorized_mandelbrot(complex_grid)

plt.figure(figsize=(8, 8), dpi=100)
plt.imshow(fractal, extent=(re_min, re_max, im_min, im_max), cmap='spring')
plt.axis('off')
plt.savefig('mandelbrot_fractal.png', bbox_inches='tight', pad_inches=0)
plt.close()

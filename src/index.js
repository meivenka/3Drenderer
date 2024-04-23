import $ from 'jquery';
import * as math from 'mathjs';

import geo from './geometries.js';

class IdAllocator {
    constructor(size) {
        this.size = size;
        this.set = new Array(size).fill(false);
    }

    get() {
        let result = this.set.findIndex((x) => !x);
        if (result == -1) {
            throw new Error("No available ID");
        }
        this.set[result] = true;
        return result;
    }

    free(id) {
        if (id < 0) {
            return ;
        }
        if (!this.set[id]) {
            throw new Error("Freeing an unused ID", id);
        }
        this.set[id] = false;
    }

    freeIds(ids) {
        ids.forEach((id) => this.free(id));
    }
}

function glTextureUnbind(gl, glTextureCounter, textureId) {
    if (textureId >= 0) {
        gl.activeTexture(gl.TEXTURE0 + textureId);
        gl.bindTexture(gl.TEXTURE_2D, null);
        glTextureCounter.free(textureId);
    }
}

function glUniformTexture(gl, glTextureCounter, glShader, prefix, texture, glTexture) {
    let flagLocation = gl.getUniformLocation(glShader, prefix + "with_" + texture);
    let location = gl.getUniformLocation(glShader, prefix + texture);
    if (!glTexture) {
        gl.uniform1i(flagLocation, 0);
        let unit = glTextureCounter.get();
        gl.uniform1i(location, unit);
        return unit;
    }
    let textureBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glTexture.width, glTexture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, glTexture.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let unit = glTextureCounter.get();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
    gl.uniform1i(location, unit);
    gl.uniform1i(flagLocation, 1);

    return unit;
}

function glAttributeArray(gl, glShader, attribute, array, size, type) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    var attributeLocation = gl.getAttribLocation(glShader, attribute);
    gl.enableVertexAttribArray(attributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attributeLocation, size, type, false, 0, 0);
}

function glUniformVec(gl, glShader, vec, value) {
    let location = gl.getUniformLocation(glShader, vec);
    
    let uniformf = {};
    switch (value.length) {
    case 2:
        uniformf = gl.uniform2fv;
        break;
    case 3:
        uniformf = gl.uniform3fv;
        break;
    case 4:
        uniformf = gl.uniform4fv;
        break;
    default:
        throw new Error("vector size for glsl should be 2, 3 or 4");
    }
    $.proxy(uniformf, gl)(location, value);
}

function glUniformIntBool(gl, glShader, bool, value) {
    let location = gl.getUniformLocation(glShader, bool);
    gl.uniform1i(location, value);
}

function glUniformStruct(gl, glShader, struct, value) {
    for (const [field, fvalue] of Object.entries(value)) {
        let location = gl.getUniformLocation(glShader, struct + "." + field);
        switch (typeof fvalue) {
        case 'boolean':
            gl.uniform1i(location, fvalue);
            break;
            
        case 'number':
            gl.uniform1f(location, fvalue);
            break;

        case 'object':
            if (Array.isArray(fvalue)) {
                let uniformf = {};
                switch (fvalue.length) {
                case 2:
                    uniformf = gl.uniform2fv;
                    break;
                case 3:
                    uniformf = gl.uniform3fv;
                    break;
                case 4:
                    uniformf = gl.uniform4fv;
                    break;
                default:
                    throw new Error("vector size for glsl should be 2, 3 or 4");
                }
                $.proxy(uniformf, gl)(location, fvalue);
            } else {
                throw new Error("Embedded struct for glsl value is not supported");
            }
            break;
            
        default:
            throw new Error("Unsupported type for glsl uniform struct, " + (typeof fvalue));
        }
    }
}

function glUniformStructArray(gl, glShader, variable, values, maxLength) {
    if (values.length > maxLength) {
        throw new Error("length of values " + values.length + " is greater than the maximum " + maxLength);
    }

    for (let i = 0; i < values.length; i++) {
        let struct = variable + "[" + i + "]";
        let value = values[i];
        glUniformStruct(gl, glShader, struct, value);
    }
    
    let lengthLocation = gl.getUniformLocation(glShader, "n_" + variable);
    gl.uniform1i(lengthLocation, values.length);
}

function glUniformMatrix(gl, glShader, uniform, matrix, size) {
    var uniformMatrixfv = {};
    switch (size) {
    case 2:
        uniformMatrixfv = gl.uniformMatrix2fv;
        break;
    case 3:
        uniformMatrixfv = gl.uniformMatrix3fv;
        break;
    case 4:
        uniformMatrixfv = gl.uniformMatrix4fv;
        break;
    default:
        throw new Error("glUniformMatrix: size of matrix should be 2x2, 3x3, or 4x4");
    }

    var location = gl.getUniformLocation(glShader, uniform);
    $.proxy(uniformMatrixfv, gl)(location, false, matrix.toArray().flat());
}

function normalize(v) {
    return math.divide(v, math.norm(v));
}

class Shape {
    constructor(shapeData) {
        this.id = shapeData.id;
        this.notes = shapeData.notes;
        this.geometry = shapeData.geometry;
        if ("texture" in shapeData)
          this.texture = shapeData.texture;
        if ("reflection" in shapeData)
          this.reflection = shapeData.reflection;

        let transMatrix = math.identity(4);

        for (const transform of shapeData.transforms) {
            let m = {};
            if ("Ry" in transform) {
                let Ry = (transform.Ry / 180) * Math.PI
                m = math.matrix([
                  [Math.cos(Ry), 0, Math.sin(Ry), 0],
                  [0, 1, 0, 0],
                  [-Math.sin(Ry), 0, Math.cos(Ry), 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("Rx" in transform) {
                let Rx = (transform.Rx / 180) * Math.PI
                m = math.matrix([
                  [1, 0, 0, 0],
                  [0, Math.cos(Rx), Math.sin(Rx), 0],
                  [0, -Math.sin(Rx), Math.cos(Rx), 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("Rz" in transform) {
                let Rz = (transform.Rz / 180) * Math.PI
                m = math.matrix([
                  [Math.cos(Rz), -Math.sin(Rz), 0, 0],
                  [Math.sin(Rz), Math.cos(Rz), 0, 0],
                  [0, 0, 1, 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("S" in transform) {
                let S = transform.S;
                m = math.matrix([
                  [S[0], 0, 0, 0],
                  [0, S[1], 0, 0],
                  [0, 0, S[2], 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("T" in transform) {
                let T = transform.T;
                m = math.matrix([
                  [1, 0, 0, T[0]],
                  [0, 1, 0, T[1]],
                  [0, 0, 1, T[2]],
                  [0, 0, 0, 1]
                ]);
            } else {
                throw new Error("Invalid transform", transform);
            }
            transMatrix = math.multiply(m, transMatrix);
        }

        this.transMatrix = transMatrix;

        this.material = shapeData.material;
    }
}

class Camera {
    constructor(from, to, bounds) {
        this.from = from;
        
        let n = normalize(math.subtract(from,  to));
        let _u = math.cross([0, 1, 0], n);
        if (math.norm(_u) < 0.1) {
            _u = math.cross([1, 0, 0], n);
        }
        let u = normalize(_u);
        let v = math.cross(n, u);
        let r = from;
        let left = bounds[3];
        let right = bounds[2];
        let bottom = bounds[5];
        let top = bounds[4];
        let near = bounds[0];
        let far = bounds[1];
        
        this.viewMatrix = math.matrix(
          [
            [u[0], u[1], u[2], -math.dot(r, u)],
            [v[0], v[1], v[2], -math.dot(r, v)],
            [n[0], n[1], n[2], -math.dot(r, n)],
            [0, 0, 0, 1]
          ]
        );
        this.perspMatrix = math.matrix(
          [
            [2 * near / (right - left), 0, (right + left) / (right - left), 0],
            [0, 2 * near / (top - bottom), (top + bottom) / (top - bottom), 0 ],
            [0, 0, -(far + near)/(far - near), -2 * (far * near) / (far - near)],
            [0, 0, -1, 0]
          ]
        );
        

        this.transMatrix = math.multiply(this.perspMatrix, this.viewMatrix);
        this.normalMatrix = math.transpose(math.pinv(this.viewMatrix));
    }

    static normalTransform(m, n) {
        n = n.slice();
        n.push(1);
        n = math.multiply(m, n).toArray();
        return normalize(n.slice(0, 3));
    }

    static transform(m, v) {
        v = v.slice();
        v.push(1);
        v = math.multiply(m, v).toArray();
        v = math.multiply(1 / v[3], v.slice(0, 3))
        return v;
    }
}

class Canvas {
    constructor(id, xres, yres, color = [255 / 255, 255 / 255, 255 / 255, 1]) {
        this.xres = xres;
        this.yres = yres;
        this.canvas = $("#" + id)[0];
        this.canvas.setAttribute("width", xres);
        this.canvas.setAttribute("height", yres);
        let gl = this.canvas.getContext("webgl2");
        this.gl = gl;
        this.glTextureCounter = new IdAllocator(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS));
        gl.clearColor(... color);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const vertexShaderSource = require('./vertex.glsl');
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        
        const fragShaderSource = require('./frag.glsl');
        var fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragShader, fragShaderSource);
        gl.compileShader(fragShader);
        
        var shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragShader);
        gl.linkProgram(shaderProgram);
        gl.useProgram(shaderProgram);
        this.glShader = shaderProgram;

        gl.enable(gl.DEPTH_TEST);
    }
}

class Scene {
    constructor(id, sceneData) {
        let cameraData = sceneData.camera;
        this.camera = new Camera(cameraData.from, cameraData.to, cameraData.bounds);
        
        let xres = cameraData.resolution[0];
        let yres = cameraData.resolution[1];

        this.canvas = new Canvas(id, xres, yres);

        this.shapes = sceneData.shapes.map((data) => new Shape(data));

        this.lights = sceneData.lights;
    }

    generateEnvTexture(shape) {
        let gl = this.canvas.gl;
        let glShader = this.canvas.glShader;
        let glTextureCounter = this.canvas.glTextureCounter;
        
        let envTextureId = glTextureCounter.get();
        let envTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + envTextureId);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, envTexture);
        
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const offsets = [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 1, 0],
          [0, -1, 0],
          [0, 0, 1],
          [0, 0, -1]
        ];
        let envCameras = [];
        for (let offset of offsets) {
            let near = shape.reflection.near;
            let far = shape.reflection.far;
            let cameraTo = math.add(shape.reflection.position, offset);
            let bounds = [near, far, near, -near, near, -near];
            envCameras.push(new Camera(shape.reflection.position, cameraTo, bounds));
        }
        const faces = [
          gl.TEXTURE_CUBE_MAP_POSITIVE_X,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
          gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
          gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
        ];

        const faceWidth = 1024;
        const faceHeight = 1024;

        for (const face of faces) {
            gl.texImage2D(face, 0, gl.RGBA, faceWidth, faceHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }

        for (const [face, envCamera] of Object.entries(envCameras)) {
            for (const shape of this.shapes) {
                let fb = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
                
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, envTexture);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, faces[face], envTexture, 0);

                let depthBuffer = gl.createRenderbuffer();
                gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
                gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.canvas.xres, this.canvas.yres);
                gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

                gl.viewport(0, 0, faceWidth, faceHeight);
                gl.clearColor(1, 1, 1, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                let tmpTextureId = glTextureCounter.get();
                glUniformIntBool(gl, glShader, "env_tex", tmpTextureId);
                this.drawShape(shape, envCamera, true);
                glTextureCounter.free(tmpTextureId);

                gl.bindRenderbuffer(gl.RENDERBUFFER, null);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            }
        }
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

        return envTextureId;
    }

    drawShape(shape, camera, skipReflection) {
        let geometry = geo.geometries[shape.geometry];
        let transMatrix = math.multiply(camera.transMatrix, shape.transMatrix);
        let normalMatrix = math.transpose(math.pinv(math.multiply(camera.viewMatrix, shape.transMatrix)));
        let scene = this;
        let perspInv = math.pinv(camera.perspMatrix);
        let glPositions = [];
        let glNormals = [];
        let glTextureCoords = [];
        for (const model of geometry.models) {
            let facesGroups = model.faces.reduce(
              (groups, face) => {
                  if (!groups[face.material]) {
                      groups[face.material] = [];
                  }
                  groups[face.material].push(face);
                  return groups;
              }
              , {});

            for (const [materialId, faces] of Object.entries(facesGroups)) {
                for (const face of faces) {
                    for (const vIndices of face.vertices) {
                        let v = model.vertices[vIndices.vertexIndex - 1];
                        v = [v.x, v.y, v.z];
                        glPositions.push.apply(glPositions, v);
                        
                        let n = model.vertexNormals[vIndices.vertexNormalIndex - 1];
                        n = [n.x, n.y, n.z];
                        glNormals.push.apply(glNormals, n);
                        
                        let t = model.textureCoords[vIndices.textureCoordsIndex - 1];
                        t = [t.u, t.v, t.w];
                        glTextureCoords.push.apply(glTextureCoords, t);
                    }
                }

                let glLights = this.lights.map(function (light) {
                    let result ={
                        "is_directional": light.type == "directional",
                        "color": light.color,
                        "intensity": light.intensity
                    };
                    if (result.is_directional) {
                        result.direction = normalize(math.subtract(light.to, light.from));
                        result.source = light.from;
                    }
                    return result;
                });

                let material = geo.materialLibs[geometry.materialLibraries[0]].find((mtl) => mtl.name == materialId);

                let rgb2vec = ((rgb) => [rgb.red, rgb.green, rgb.blue]);

                let glMaterial = {
                    "ka": rgb2vec(material.Ka),
                    "ks": rgb2vec(material.Ks),
                    "kd": rgb2vec(material.Kd),
                    "n": material.illum,
                    "is_procedural_texture": false
                };

                if ("texture" in shape) {
                    glMaterial.is_procedural_texture = true;
                    let texture = shape.texture;
                    let is_tex_perlin = false;
                    switch(texture.type) {
                    case "perlin":
                        is_tex_perlin = true;
                        break;

                    default:
                        throw new Error("Procedural texture type invalid ", texture.type);
                    }
                    glMaterial.is_tex_perlin = is_tex_perlin;
                    glMaterial.tex_nwidth = texture.nwidth;
                    glMaterial.tex_nheight = texture.nheight;
                    glMaterial.tex_seed = Math.random();
                    glMaterial.tex_background = texture.background;
                    glMaterial.tex_color = texture.color;
                }

                let gl = this.canvas.gl;
                let glTextureCounter = this.canvas.glTextureCounter;
                let glShader = this.canvas.glShader;

                let textureIds = [];

                if (skipReflection || !("reflection" in shape)) {
                    let envTextureId = glTextureCounter.get();
                    textureIds.push(envTextureId);
                    glUniformIntBool(gl, glShader, "has_reflection", 0);
                } else {
                    let envTextureId = this.generateEnvTexture(shape);
                    textureIds.push(envTextureId);
                    glUniformIntBool(gl, glShader, "has_reflection", 1);
                    glUniformIntBool(gl, glShader, "env_tex", envTextureId);
                }

                glAttributeArray(gl, glShader, "position", new Float32Array(glPositions), 3, gl.FLOAT);
                glAttributeArray(gl, glShader, "normal", new Float32Array(glNormals), 3, gl.FLOAT);
                glAttributeArray(gl, glShader, "texture_coord", new Float32Array(glTextureCoords), 3, gl.FLOAT);

                glUniformMatrix(gl, glShader, "world_matrix", shape.transMatrix, 4);
                glUniformMatrix(gl, glShader, "world_matrix_inv_transpose", math.transpose(math.inv(shape.transMatrix)), 4);
                
                glUniformMatrix(gl, glShader, "persp_matrix", camera.perspMatrix, 4);
                glUniformMatrix(gl, glShader, "camera_matrix", camera.viewMatrix, 4);
                glUniformVec(gl, glShader, "camera_from", camera.from, 4);

                glUniformStructArray(gl, glShader, "lights", glLights);

                glUniformStruct(gl, glShader, "material", glMaterial);

                let glTextureKa = geo.textures[material.map_Ka.file];
                textureIds.push(glUniformTexture(gl, glTextureCounter, glShader, "material.", "ka_texture", glTextureKa));

                let glTextureKs = geo.textures[material.map_Ks.file];
                textureIds.push(glUniformTexture(gl, glTextureCounter, glShader, "material.", "ks_texture", glTextureKs));

                let glTextureKd = geo.textures[material.map_Kd.file];
                textureIds.push(glUniformTexture(gl, glTextureCounter, glShader, "material.", "kd_texture", glTextureKd));

                gl.drawArrays(gl.TRIANGLES, 0, glPositions.length / 3);

                textureIds.forEach((textureId) => glTextureUnbind(gl, glTextureCounter, textureId));
            }
        }
    }

    draw() {
        for (const shape of this.shapes) {
            this.drawShape(shape, this.camera, false);
        }
    }
}

async function main(canvasId, sceneData) {
    await geo.loadAll();
    
    let scene = new Scene(canvasId, sceneData);
    scene.draw();
}

const SCENE_DATA = require('./scene-data.json');

main("canvas1", SCENE_DATA);

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
        return result;
    }

    free(id) {
        if (!this.set[id]) {
            throw new Error("Freeing an unused ID", id);
        }
        this.set[id] = false;
    }

    freeAll() {
        this.set = new Array(this.size).fill(false);
    }
}

function glUniformTexture(gl, glCounter, glShader, prefix, texture, glTexture) {
    let flagLocation = gl.getUniformLocation(glShader, prefix + "with_" + texture);
    if (!glTexture) {
        gl.uniform1i(flagLocation, 0);
        return ;
    }
    let textureBuffer = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, glTexture.width, glTexture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, glTexture.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    let location = gl.getUniformLocation(glShader, prefix + texture);
    let unit = glCounter.get();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
    gl.uniform1i(location, unit);
    gl.uniform1i(flagLocation, 1);
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
    constructor(u, v, n, r, left, right, bottom, top, near, far) {
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
        this.glCounter = new IdAllocator(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS));
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
        let cameraFrom = cameraData.from;
        let cameraTo = cameraData.to;
        let bounds = cameraData.bounds;
        let n = normalize(math.add(cameraFrom, math.multiply(-1, cameraTo)));
        let u = normalize(math.cross([0, 1, 0], n));
        let v = math.cross(n, u);
        let r = cameraFrom;
        let left = bounds[3];
        let right = bounds[2];
        let bottom = bounds[5];
        let top = bounds[4];
        let near = bounds[0];
        let far = bounds[1];
        this.camera = new Camera(u, v, n, r, left, right, bottom, top, near, far);
        
        let xres = cameraData.resolution[0];
        let yres = cameraData.resolution[1];

        this.canvas = new Canvas(id, xres, yres);

        this.shapes = sceneData.shapes.map((data) => new Shape(data));

        this.lights = sceneData.lights;
    }    

    drawShape(shape) {
        let camera = this.camera;
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

                let glLights = this.lights.map((light) => ({
                    "is_directional": light.type == "directional",
                    "color": light.color,
                    "intensity": light.intensity,
                    "direction": light.type == "directional" ? normalize(math.subtract(light.to, light.from)) : [1, 0, 0]
                }));

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

                // TODO move to canvas
                let gl = this.canvas.gl;
                let glCounter = this.canvas.glCounter;
                let glShader = this.canvas.glShader;

                glAttributeArray(gl, glShader, "position", new Float32Array(glPositions), 3, gl.FLOAT);
                glAttributeArray(gl, glShader, "normal", new Float32Array(glNormals), 3, gl.FLOAT);
                glAttributeArray(gl, glShader, "texture_coord", new Float32Array(glTextureCoords), 3, gl.FLOAT);

                glUniformMatrix(gl, glShader, "trans_matrix", transMatrix, 4);
                glUniformMatrix(gl, glShader, "normal_matrix", normalMatrix, 4);
                
                glUniformMatrix(gl, glShader, "persp_matrix_inv", perspInv, 4);
                glUniformMatrix(gl, glShader, "camera_normal_matrix", camera.normalMatrix, 4);

                glUniformStructArray(gl, glShader, "lights", glLights);

                glUniformStruct(gl, glShader, "material", glMaterial);

                let glTextureKa = geo.textures[material.map_Ka.file];
                glUniformTexture(gl, glCounter, glShader, "material.", "ka_texture", glTextureKa);

                let glTextureKs = geo.textures[material.map_Ks.file];
                glUniformTexture(gl, glCounter, glShader, "material.", "ks_texture", glTextureKs);

                let glTextureKd = geo.textures[material.map_Kd.file];
                glUniformTexture(gl, glCounter, glShader, "material.", "kd_texture", glTextureKd);
                
                gl.drawArrays(gl.TRIANGLES, 0, glPositions.length / 3);
                glCounter.freeAll();
            }
        }
    }

    draw() {
        for (const shape of this.shapes) {
            this.drawShape(shape);
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

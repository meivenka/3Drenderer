import $ from 'jquery';
import * as math from 'mathjs';

import geo from './geometries.js';

function glAttributeArray(gl, glShader, attribute, array, size, type) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    var attributeLocation = gl.getAttribLocation(glShader, attribute);
    gl.enableVertexAttribArray(attributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attributeLocation, size, type, false, 0, 0);
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

function line2d(v1, v2) {
    return function(v) {
        return (v1[1] - v2[1]) * v[0] + (v2[0] - v1[0]) * v[1] + (v1[0] * v2[1] - v2[0] * v1[1]);
    }
}

function normalize(v) {
    return math.divide(v, math.norm(v));
}

class Shape {
    constructor(shapeData) {
        this.id = shapeData.id;
        this.notes = shapeData.notes;
        this.geometry = shapeData.geometry;

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

    getTextureColorPrecise(x, y) {
        let texture = textures[this.material.texture];
        x %= texture.width;
        x = texture.width - 1 - x;
        y %= texture.height;
        let index = x + y * texture.width;
        let offset = 4 * index;
        let color = Array.from(texture.data.slice(offset, offset + 4));
        color = color.map((n) => n / 255);
        return color;
    }

    getTextureColor(t) {
        if ("texture" in this.material) {
            let Kt = this.material.Kt;
            let x = t[0] * (texture.width - 1);
            let x0 = Math.floor(x);
            let x1 = x0 + 1;
            let y = t[1] * (texture.height - 1);
            let y0 = Math.floor(y);
            let y1 = y0 + 1;
            let c00 = this.getTextureColorPrecise(x0, y0);
            let c01 = this.getTextureColorPrecise(x0, y1);
            let c10 = this.getTextureColorPrecise(x1, y0);
            let c11 = this.getTextureColorPrecise(x1, y1);
            let c0 = math.add(math.multiply(y - y0, c01), math.multiply(y1 - y, c00));
            let c1 = math.add(math.multiply(y - y0, c11), math.multiply(y1 - y, c10));
            let color = math.add(math.multiply(x - x0, c1), math.multiply(x1 - x, c0));
            color = math.multiply(Kt, color);
            
            return color;
        } else {
            return [0, 0, 0, 0];
        }
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
        let gl = this.canvas.getContext("webgl");
        this.gl = gl;
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
        let u = math.cross([0, 1, 0], n);
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
    
    clacLighting(material, v, perspInv, cameraNormalMatrix) {
        let color = [0, 0, 0];

        for (const light of this.lights) {
            switch (light.type) {
            case "ambient":
                let dColor = math.multiply(light.intensity * material.Ka, light.color);
                dColor = math.dotMultiply(dColor, material.Cs);
                color = math.add(color, dColor);
                break;

            case "directional":
                let vCam = Camera.transform(perspInv, v.v);
                let E = normalize(math.multiply(-1, vCam));
                let N = v.n;
                let lightN = normalize(math.add(light.from, math.multiply(-1, light.to)));
                let L = Camera.normalTransform(cameraNormalMatrix, lightN);
                let R = [0, 0, 0];
                if (math.dot(L, N) > 0) {
                    R = normalize(math.add(math.multiply(2 * math.dot(L, N), N), math.multiply(-1, L)));
                }
                let dSpecular = math.multiply(
                  light.intensity * Math.pow(Math.max(math.dot(R, E), 0), material.n) * material.Ks,
                  light.color);
                let dDiffuse = math.multiply(light.intensity * Math.max(math.dot(N, L), 0) * material.Kd, light.color);
                dDiffuse = math.dotMultiply(dDiffuse, material.Cs);
                color = math.add(color, dSpecular, dDiffuse);
                break;
                
            default:
                throw new Error("Invalid light type", light.type);
                break;
            }
        }

        color = color.map((n) => Math.min(n, 1));
        color.push(1);
        return color;
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
        let model = geometry.models[0];
        for (const face of model.faces) {
            let lightingPhong = function(v) {
                return scene.clacLighting(shape.material, v, perspInv, camera.normalMatrix);
            };
            let shader = function(v) {
                let lighting = lightingPhong;
                let lightingColor = lighting(v);
                let textureColor = shape.getTextureColor(v.t);
                let color = math.add(lightingColor, textureColor);
                color = color.map((n) => Math.min(n, 1));
                return color;
            }
            face.vertices.forEach(function(vIndices) {
                let v = model.vertices[vIndices.vertexIndex - 1];
                v = [v.x, v.y, v.z];
                glPositions.push.apply(glPositions, v);
                
                let n = model.vertexNormals[vIndices.vertexNormalIndex - 1];
                n = [n.x, n.y, n.z];
                glNormals.push.apply(glNormals, n);
                
                let t = model.textureCoords[vIndices.textureCoordsIndex - 1];
                t = [t.u, t.v, t.w];
                glTextureCoords.push.apply(glTextureCoords, t);
            });
        }

        // TODO move to canvas
        let gl = this.canvas.gl;
        let glShader = this.canvas.glShader;

        glAttributeArray(gl, glShader, "position", new Float32Array(glPositions), 3, gl.FLOAT);
        glAttributeArray(gl, glShader, "normal", new Float32Array(glNormals), 3, gl.FLOAT);
        glAttributeArray(gl, glShader, "texture_coord", new Float32Array(glTextureCoords), 3, gl.FLOAT);

        glUniformMatrix(gl, glShader, "trans_matrix", transMatrix, 4);
        glUniformMatrix(gl, glShader, "normal_matrix", normalMatrix, 4);
        
        glUniformMatrix(gl, glShader, "persp_matrix_inv", perspInv, 4);
        glUniformMatrix(gl, glShader, "camera_normal_matrix", camera.normalMatrix, 4);
        
        gl.drawArrays(gl.TRIANGLES, 0, 3 * model.faces.length);
    }

    draw() {
        this.shapes.forEach((shape) => this.drawShape(shape));
    }
}

async function main(canvasId, sceneData) {
    await geo.loadAll();
    
    let scene = new Scene(canvasId, sceneData);
    scene.draw();
}

const SCENE_DATA = require('./scene-data.json');

main("canvas1", SCENE_DATA);

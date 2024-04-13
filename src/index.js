import $ from 'jquery';
import * as math from 'mathjs';

import geometries from './geometries.js';

function line2d(v1, v2) {
    return function(v) {
        return (v1[1] - v2[1]) * v[0] + (v2[0] - v1[0]) * v[1] + (v1[0] * v2[1] - v2[0] * v1[1]);
    }
}

function normalize(v) {
    return math.divide(v, math.norm(v));
}

class Matrix {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = new Array(rows * cols).fill(0);
    }

    getElem(row, col) {
        return this.data[row * this.rows + col];
    }

    setElem(row, col, val) {
        this.data[row * this.rows + col] = val;
    }

    fromRowList(rowList) {
        if (rowList.length != this.rows) {
            throw new Error('Invalid rowList');
        }

        for (let i = 0; i < rowList.length; i++) {
            if (rowList[i].length != this.cols) {
                throw new Error('Invalid rowList');
            }
            for (let j = 0; j < rowList[i].length; j++) {
                this.setElem(i, j, rowList[i][j]);
            }
        }
    }

    copy() {
        let m = new Matrix(this.rows, this.cols);
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                m.setElem(i, j, this.getElem(i, j));
            }
        }
        return m;
    }

    xVector(v) {
        if (v.length != this.cols) {
            return undefined;
        }
        let result = [];
        for (let i = 0; i < this.rows; i++) {
            result.push(math.dot(v, this.getRow(i)));
        }
        return result;
    }

    vectorX(v) {
        if (v.length != this.rows) {
            return undefined;
        }
        let result = [];
        for (let j = 0; j < this.cols; j++) {
            result.push(math.dot(v, this.getCol(j)));
        }
        return result;
    }

    getRow(row) {
        let result = [];
        for (let j = 0; j < this.cols; j++) {
            result.push(this.getElem(row, j));
        }
        return result;
    }

    setRow(row, v) {
        if (v.length != this.cols) {
            throw new Error('Invalid vector for setRow');
        }
        for (let j = 0; j < this.cols; j++) {
            this.setElem(row, j, v[j]);
        }
    }

    getCol(col) {
        let result = [];
        for (let i = 0; i < this.rows; i++) {
            result.push(this.getElem(i, col));
        }
        return result;
    }

    static x(m1, m2) {
        if (m1.cols != m2.rows) {
            return undefined;
        }
        
        let m = new Matrix(m1.rows, m2.cols);
        for (let i = 0; i < m1.rows; i++) {
            for (let j = 0; j < m2.cols; j++) {
                m.setElem(i, j, math.dot(m1.getRow(i), m2.getCol(j)));
            }
        }
        return m;
    }

    inv() {
        if (this.cols != this.rows) {
            return undefined;
        }

        let m = this.copy();
        let I = new Matrix(m.rows, m.cols);
        for (let i = 0; i < m.rows; i++) {
            I.setElem(i, i, 1);
        }

        for (let i = 0; i < m.rows; i++) {
            let v = m.getRow(i);
            let vI = I.getRow(i);
            let v_ = v.slice();
            v = math.multiply(1 / v_[i], v);
            vI = math.multiply(1 / v_[i], vI);
            m.setRow(i, v);
            I.setRow(i, vI);
            for (let i2 = i + 1; i2 < m.rows; i2++) {
                let v2 = m.getRow(i2);
                let v2I = I.getRow(i2);
                let v2_ = v2.slice();
                v2 = math.add(v2, math.multiply(-v2_[i], v));
                v2I = math.add(v2I, math.multiply(-v2_[i], vI));
                m.setRow(i2, v2);
                I.setRow(i2, v2I);
            }
        }

        for (let i = m.rows - 1; i >= 0; i--) {
            let v = m.getRow(i);
            let vI = I.getRow(i);
            for (let i2 = i - 1; i2 >= 0 ; i2--) {
                let v2 = m.getRow(i2);
                let v2I = I.getRow(i2);
                let v2_ = v2.slice();
                v2 = math.add(v2, math.multiply(-v2_[i], v));
                v2I = math.add(v2I, math.multiply(-v2_[i], vI));
                m.setRow(i2, v2);
                I.setRow(i2, v2I);
            }
        }
        return I;
    }

    transpose() {
        let m = this.copy();
        for (let i = 0; i < m.rows; i++) {
            for (let j = 0; j < i; j++) {
                let t = m.getElem(i, j);
                m.setElem(i, j, m.getElem(j, i));
                m.setElem(j, i, t);
            }
        }
        return m;
    }
}

function triangleColor(n) {
    let dotp = 0.707 * n[0] + 0.5 * n[1] + 0.5 * n[2];
    dotp = Math.abs(dotp);
    
    if (dotp > 1)
      dotp = 1;

    let c = [];
    c[0] = 0.95 * dotp;
    c[1] = 0.65 * dotp;
    c[2] = 0.88 * dotp;
    c[3] = 1;

    return c;
}

class Triangle {
    constructor(data, transMatrix, normalMatrix) {
        this.vs = JSON.parse(JSON.stringify([data.v0, data.v1, data.v2]));
        for (let v of this.vs) {
            v.v = Camera.transform(transMatrix, v.v);
            v.n = Camera.normalTransform(normalMatrix, v.n);
        }
    }

    barycentric(v) {
        var f12 = line2d(this.vs[1].v, this.vs[2].v);
        var f20 = line2d(this.vs[2].v, this.vs[0].v);
        var f01 = line2d(this.vs[0].v, this.vs[1].v);
        var alpha = f12(v) / f12(this.vs[0].v);
        var beta = f20(v) / f20(this.vs[1].v);
        var gamma = f01(v) / f01(this.vs[2].v);
        return [alpha, beta, gamma];
    }

    getInside(v) {
        let b = this.barycentric(v);
        if (!(b[0] > 0 && b[1] > 0 && b[2] > 0)) {
            return null;
        }
        let result = {};
        result.v = math.add(math.multiply(b[0], this.vs[0].v), math.multiply(b[1], this.vs[1].v), math.multiply(b[2], this.vs[2].v));
        result.n = math.add(math.multiply(b[0], this.vs[0].n), math.multiply(b[1], this.vs[1].n), math.multiply(b[2], this.vs[2].n));
        result.t = math.multiply(result.v[2],
                                  math.add(math.multiply(b[0] / this.vs[0].v[2], this.vs[0].t),
                                              math.multiply(b[1] / this.vs[1].v[2], this.vs[1].t),
                                              math.multiply(b[2] / this.vs[2].v[2], this.vs[2].t)));
        return result;
    }
}

class Shape {
    constructor(shapeData) {
        this.id = shapeData.id;
        this.notes = shapeData.notes;
        this.geometry = shapeData.geometry;

        let transMatrix = new Matrix(4, 4);
        transMatrix.fromRowList([
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1]
        ]);

        for (const transform of shapeData.transforms) {
            let m = new Matrix(4, 4);
            if ("Ry" in transform) {
                let Ry = (transform.Ry / 180) * Math.PI
                m.fromRowList([
                  [Math.cos(Ry), 0, Math.sin(Ry), 0],
                  [0, 1, 0, 0],
                  [-Math.sin(Ry), 0, Math.cos(Ry), 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("Rx" in transform) {
                let Rx = (transform.Rx / 180) * Math.PI
                m.fromRowList([
                  [1, 0, 0, 0],
                  [0, Math.cos(Rx), Math.sin(Rx), 0],
                  [0, -Math.sin(Rx), Math.cos(Rx), 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("Rz" in transform) {
                let Rz = (transform.Rz / 180) * Math.PI
                m.fromRowList([
                  [Math.cos(Rz), -Math.sin(Rz), 0, 0],
                  [Math.sin(Rz), Math.cos(Rz), 0, 0],
                  [0, 0, 1, 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("S" in transform) {
                let S = transform.S;
                m.fromRowList([
                  [S[0], 0, 0, 0],
                  [0, S[1], 0, 0],
                  [0, 0, S[2], 0],
                  [0, 0, 0, 1]
                ]);
            } else if ("T" in transform) {
                let T = transform.T;
                m.fromRowList([
                  [1, 0, 0, T[0]],
                  [0, 1, 0, T[1]],
                  [0, 0, 1, T[2]],
                  [0, 0, 0, 1]
                ]);
            } else {
                throw new Error("Invalid transform", transform);
            }
            transMatrix = Matrix.x(m, transMatrix);
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
        this.viewMatrix = new Matrix(4, 4);
        this.viewMatrix.fromRowList(
          [
            [u[0], u[1], u[2], -math.dot(r, u)],
            [v[0], v[1], v[2], -math.dot(r, v)],
            [n[0], n[1], n[2], -math.dot(r, n)],
            [0, 0, 0, 1]
          ]
        );
        this.perspMatrix = new Matrix(4, 4);
        this.perspMatrix.fromRowList(
          [
            [2 * near / (right - left), 0, (right + left) / (right - left), 0],
            [0, 2 * near / (top - bottom), (top + bottom) / (top - bottom), 0 ],
            [0, 0, -(far + near)/(far - near), -2 * (far * near) / (far - near)],
            [0, 0, -1, 0]
          ]
        );
        

        this.transMatrix = Matrix.x(this.perspMatrix, this.viewMatrix);
        this.normalMatrix = this.viewMatrix.inv().transpose();
    }

    static normalTransform(m, n) {
        n = n.slice();
        n.push(1);
        n = m.xVector(n);
        return normalize(n.slice(0, 3));
    }

    static transform(m, v) {
        v = v.slice();
        v.push(1);
        v = m.xVector(v);
        v = math.multiply(1 / v[3], v.slice(0, 3))
        return v;
    }
}

class Subcanvas {
    constructor(xres, yres, color) {
        this.xres = xres;
        this.yres = yres;
        this.data = Array(xres * yres).fill(color);
        this.zBuffer = Array(xres * yres).fill(Infinity);
    }

    setPixel(v, color) {
        let x = Math.round(v[0]);
        let y = Math.round(v[1]);
        y = this.yres - 1 - y;
        let z = v[2];
        let index = (x + y * this.xres);
        if (z <= this.zBuffer[index]) {
            this.zBuffer[index] = z;
            this.data[index] = color;
        }
    }
}

class Canvas {
    constructor(id, xres, yres, aa, color = [255 / 255, 255 / 255, 255 / 255, 1]) {
        if (aa.length <= 0) {
            throw new Error("Size of antialiasing should be greater than 0");
        }
        let aaSum = aa.reduce((sum, subaa) => sum + subaa[2], 0);
        if (Math.abs(aaSum - 1) > 0.001) {
            throw new Error("Sum of antialiasing weights should be 1");
        }
        
        this.xres = xres;
        this.yres = yres;
        this.el = $("#" + id)[0];
        this.el.setAttribute("width", xres);
        this.el.setAttribute("height", yres);
        this.canvas = this.el.getContext("2d");
        this.img = this.canvas.createImageData(xres, yres);
        this.subs = aa.map((subaa) => ({"dx": subaa[0], "dy": subaa[1], "weight": subaa[2],
                                        "subcanvas": new Subcanvas(xres, yres, color)}));
    }

    toCanvasX(x) {
        return (x + 1) * (this.xres - 1) / 2;
    }

    toCanvasY(y) {
        return (y + 1) * (this.yres - 1) / 2;
    }

    fromCanvasX(cx) {
        return 2 * cx / (this.xres - 1) - 1;
    }

    fromCanvasY(cy) {
        return 2 * cy / (this.yres - 1) - 1;
    }
    
    drawTriangle(triangle, shader) {
        for (let sub of this.subs) {
            let dx = sub.dx;
            let dy = sub.dy;
            let xmin = Math.max(Math.min(triangle.vs[0].v[0], triangle.vs[1].v[0], triangle.vs[2].v[0]), -1);
            let xmax = Math.min(Math.max(triangle.vs[0].v[0], triangle.vs[1].v[0], triangle.vs[2].v[0]), 1);
            let ymin = Math.max(Math.min(triangle.vs[0].v[1], triangle.vs[1].v[1], triangle.vs[2].v[1]), -1);
            let ymax = Math.min(Math.max(triangle.vs[0].v[1], triangle.vs[1].v[1], triangle.vs[2].v[1]), 1);
            for (let cx = Math.floor(this.toCanvasX(xmin) + dx); cx <= Math.ceil(this.toCanvasX(xmax) + dx); cx++) {
                for (let cy = Math.floor(this.toCanvasY(ymin) + dy); cy <= Math.ceil(this.toCanvasY(ymax) + dy); cy++) {
                    let x = this.fromCanvasX(cx - dx);
                    let y = this.fromCanvasY(cy - dy);
                    let v = triangle.getInside([x, y]);
                    if (v == null) {
                        continue;
                    }
                    let color = shader(triangle, v);
                    sub.subcanvas.setPixel([cx, cy, v.v[2]], color);
                }
            }
        }
    }
    
    update() {
        for (let x = 0; x < this.xres; x++) {
            for (let y = 0; y < this.yres; y++) {
                let index = x + y * this.xres;
                let color = this.subs.reduce((avgColor, sub) =>
                  (math.add(avgColor, math.multiply(sub.weight, sub.subcanvas.data[index]))),
                  [0, 0, 0, 0]);
                
                let r = Math.round(255 * color[0]);
                let g = Math.round(255 * color[1]);
                let b = Math.round(255 * color[2]);
                let a = Math.round(255 * color[3]);

                let offset = 4 * index;
                
                let data = this.img.data;
                data[offset + 0] = r;
                data[offset + 1] = g;
                data[offset + 2] = b;
                data[offset + 3] = a;
            }
        }
        this.canvas.putImageData(this.img, 0, 0);
    }
}

class Scene {
    constructor(id, sceneData, shaderType, aa = [[0, 0, 1]]) {
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

        this.canvas = new Canvas(id, xres, yres, aa);

        this.shapes = sceneData.shapes.map((data) => new Shape(data));

        this.lights = sceneData.lights;

        this.shaderType = shaderType;
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
                /* let lightN2 = Vector.normalize(Vector.add([light.to, math.multiply(-1, light.from)]));
                 * let L2 = Camera.normalTransform(cameraNormalMatrix, lightN2);
                 * let lightFrom = Camera.transform(cameraNormalMatrix.inv().transpose(), light.from);
                 * let lightTo = Camera.transform(cameraNormalMatrix.inv().transpose(), light.to);
                 * let L3 = Vector.normalize(Vector.add([lightFrom, math.multiply(-1, lightTo)]));
                 * L = L3;
                 * console.log(lightN, lightN2);
                 * console.log(L, L2, L3);
                 * console.log(cameraNormalMatrix);
                 * throw new Error("bye"); */
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
        let geometry = geometries[shape.geometry];
        let transMatrix = Matrix.x(camera.transMatrix, shape.transMatrix);
        let normalMatrix = Matrix.x(camera.viewMatrix, shape.transMatrix).inv().transpose();
        let scene = this;
        let perspInv = camera.perspMatrix.inv();
        for (const triangleData of geometry.data) {
            let triangle = new Triangle(triangleData, transMatrix, normalMatrix);
            let lightingPhong = function(triangle, v) {
                return scene.clacLighting(shape.material, v, perspInv, camera.normalMatrix);
            };
            let lightingGouraud = function(triangle, v) {
                let colors = triangle.vs.map((v) => scene.clacLighting(shape.material, v, perspInv, camera.normalMatrix));
                let b = triangle.barycentric(v.v);
                let color = math.add(math.multiply(b[0], colors[0]), math.multiply(b[1], colors[1]), math.multiply(b[2], colors[2]));
                return color;
            };
            let shaderType = this.shaderType;
            let shader = function(triangle, v) {
                let lighting = (shaderType == "Phong") ? lightingPhong : lightingGouraud;
                let lightingColor = lighting(triangle, v);
                let textureColor = shape.getTextureColor(v.t);
                let color = math.add(lightingColor, textureColor);
                color = color.map((n) => Math.min(n, 1));
                return color;
            }
            this.canvas.drawTriangle(triangle, shader);
        }
    }

    draw() {
        this.shapes.forEach((shape) => this.drawShape(shape));
    }

    update() {
        this.canvas.update();
    }
}

function main(canvasId, sceneData) {
    let scene = new Scene(canvasId, sceneData);
    scene.draw();
    scene.update();
}

const SCENE_DATA = require('./scene-data.json');

main("canvas1", SCENE_DATA);

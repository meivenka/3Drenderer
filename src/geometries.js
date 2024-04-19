import $ from 'jquery';
import OBJFile from 'obj-file-parser';
import MTLFile from 'mtl-file-parser';

var geometries = {
};

var materialLibs = {
};

var textures = {
};

const geometriesPaths = {
    "box.obj": "./box.obj",
    "background.obj": "./background.obj",
    "ground.obj": "./ground.obj",
    "tree.obj": "./tree.obj",
}

const materialLibsPaths = {
    "box.mtl": "./box.mtl",
    "background.mtl": "./background.mtl",
    "ground.mtl": "./ground.mtl",
    "tree.mtl": "./tree.mtl",
}

const texturesPaths = {
    "box.png": "./box.png",
    "background.png": "./background.png",
    "ground.png": "./ground.png",
}

async function loadObj(name, path) {
    await $.get(path, function(objContent) {
        let obj = new OBJFile(objContent);
        let geometry = obj.parse();
        geometries[name] = geometry;
        console.log(geometry);
    });
}

async function loadMtl(name, path) {
    await $.get(path, function(objContent) {
        let mtl = new MTLFile(objContent);
        let materialLib = mtl.parse();
        materialLibs[name] = materialLib;
        console.log(materialLib);
    });
}

async function loadImg(name, path) {
    let img = new Image();
    
    const imageLoadPromise = new Promise(resolve => {
        img.onload = resolve;
        img.setAttribute('src', path);
    });

    await imageLoadPromise;
    
    let width = img.width;
    let height = img.height;
    let tmp = document.createElement('canvas');;
    tmp.setAttribute("width", width);
    tmp.setAttribute("height", height);
    let ctx = tmp.getContext('2d');
    ctx.drawImage(img, 0, 0);
    textures[name] = ctx.getImageData(0, 0, width, height);
}

async function loadAll() {
    for (const [name, path] of Object.entries(geometriesPaths)) {
        await loadObj(name, path);
    }
    for (const [name, path] of Object.entries(texturesPaths)) {
        await loadImg(name, path);
    }
    for (const [name, path] of Object.entries(materialLibsPaths)) {
        await loadMtl(name, path);
    }
}

export default {
    textures, materialLibs, geometries, loadAll
};

import $ from 'jquery';
import OBJFile from 'obj-file-parser';

var geometries = {
};

var textures = {
};

const geometriesPaths = {
    "teapot": "./teapot.obj"
}

const texturesSrcs = {
    "./test.png": "./test.png"
}

async function loadObj(name, path) {
    await $.get(path, function(objContent) {
        let obj = new OBJFile(objContent);
        let geometry = obj.parse();
        geometries[name] = geometry;
        console.log(geometry);
    });
}

async function loadImg(name, src) {
    let img = new Image();
    
    const imageLoadPromise = new Promise(resolve => {
        img.onload = resolve;
        img.setAttribute('src', src);
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
    for (const [name, src] of Object.entries(texturesSrcs)) {
        await loadImg(name, src);
    }
}

export default {
    textures, geometries, loadAll
};

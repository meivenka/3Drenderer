import $ from 'jquery';
import OBJFile from 'obj-file-parser';

var geometries = {
};

const geometriesPaths = {
    "teapot": "./teapot.obj"
}

async function loadObj(name, path) {
    await $.get(path, function(objContent) {
        let obj = new OBJFile(objContent);
        let geometry = obj.parse();
        geometries[name] = geometry;
        console.log(geometry);
    });
}

async function loadAll() {
    for (const [name, path] of Object.entries(geometriesPaths)) {
        await loadObj(name, path);
    }
}

export default {
    geometries, loadAll
};

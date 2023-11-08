import process from "process"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { SOURCE_DIR, RESOURCE_TYPE, RESOURCE_COVERS, CATEGORY_DEFAULT_NAME } from "./constants.js"

let slug = function (input) {
    return input.replace(/\s/g, "-").replace(/([^A-Za-z0-9\-])|(-$)/g, "").toLowerCase()
}

let pad = function(num, size) {
    let s = num + ""
    while (s.length < size) s = "0" + s
    return s
}

let escapeAssetPathForSed = function (assetPath) {
    return assetPath.replace(/([\[\]()\\\/*&])/g, `\\$1`)
}

let getResourceTypesGlob = function () {
    return `+(${Object.values(RESOURCE_TYPE).join("|")})`
}

let getPositiveCoverImagesGlob = function () {
    return `+(${Object.values(RESOURCE_COVERS).join("|")})`
}

let getNegativeCoverImagesGlob = function () {
    return `!(${Object.values(RESOURCE_COVERS).join("|")})`
}

let parseResourcePath = function (resourcePath) {
    if (/^\.\/src\//.test(resourcePath)) {
        resourcePath = resourcePath.replace(`${SOURCE_DIR}/`, "")
    }
    let pathRegExp = /^([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?/mg,
        matches = pathRegExp.exec(resourcePath),
        info = {};

    try {
        info.language = matches[1] || null;
        info.type = matches[2] || null;
        info.title = matches[3] || null;
        info.section = (matches[4] && matches[5] && !/\.md$/.test(matches[5])) ? matches[5] : CATEGORY_DEFAULT_NAME;
        info.document = matches[6] ? matches[6] : (matches[5] && /\.md$/.test(matches[5])) ? matches[5] : null;
        if (info.document) { info.document = info.document.replace(".md", "") }
    } catch (e) {
        console.error(e)
    }

    return info;
}

let isMainModule = function (meta) {
    if (!meta || !process.argv[1]) {
        return false;
    }
    const require = createRequire(meta.url)
    const scriptPath = require.resolve(process.argv[1])
    const modulePath = fileURLToPath(meta.url)

    return modulePath === scriptPath
}

export {
    parseResourcePath,
    isMainModule,
    slug,
    pad,
    getResourceTypesGlob,
    getPositiveCoverImagesGlob,
    getNegativeCoverImagesGlob,
    escapeAssetPathForSed
}
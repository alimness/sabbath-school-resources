import process from "process"
import https from "https"
import { imageSize } from "image-size"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import { SOURCE_DIR, RESOURCE_TYPE, RESOURCE_COVERS, CATEGORY_DEFAULT_NAME, RESOURCE_FONTS_DIRNAME } from "./constants.js"

async function getBufferFromUrl(url) {
    return new Promise((resolve) => {
        https.get(url, (response) => {
            const body = []
            response
                .on("data", (chunk) => {
                    body.push(chunk)
                })
                .on("end", () => {
                    resolve(Buffer.concat(body))
                })
        })
    })
}

let determineFontWeight = async function (fontStr) {
    const weights = {
        100: /Thin|Hairline/i,
        200: /(Extra|Ultra)([- _])?Light/i,
        300: /Light/i,
        400: /Normal|Regular/i,
        500: /Medium/i,
        600: /(Semi|Demi)([- _])?Bold/i,
        700: /Bold/i,
        800: /(Extra|Ultra)([- _])?Bold/i,
        900: /Black|Heavy/i,
    }
    for (let weight of Object.keys(weights)) {
        if (weights[weight].test(fontStr)) {
            return weight
        }
    }
    return null
}

let getImageRatio = async function (src) {
    const DEFAULT_IMAGE_RATIO = 16/9
    const DECIMAL_POINTS = 3
    try {
        const dimensions = await imageSize(src)
        return parseFloat((dimensions.width / dimensions.height).toFixed(DECIMAL_POINTS))
    } catch (e) {
        return parseFloat(DEFAULT_IMAGE_RATIO.toFixed(DECIMAL_POINTS))
    }
}

let isURL = function (src) {
    return /^http/.test(src.trim())
}

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

let getFontsGlob = function () {
    return `${RESOURCE_FONTS_DIRNAME}/*.ttf`
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
        console.error(`Error parsing resource path: ${e}`);
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
    getFontsGlob,
    escapeAssetPathForSed,
    getImageRatio,
    isURL,
    getBufferFromUrl,
    determineFontWeight
}
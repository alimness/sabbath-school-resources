import fs from "fs-extra"
import { RESOURCE_ASSETS_DIRNAME, SOURCE_DIR, DEPLOY_ENV, DIST_DIR, ASSETS_URL } from "../constants.js"

let imageExists = function (src) {
    return fs.pathExistsSync(src)
}

export const image = {
    extension: {
        name: "image",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^({\s*"?style"?\s*:.*})?\s*!\[([^\[\]]*)\]\(?([^\[\]\)]+)?\)?/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "image",
                    raw: match[0],
                    src: match[3] ? match[3] : match[2],
                    caption: match[3] ? match[2]: match[1] || null,
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: image`;
        }
    },
    process: async function (block, resourcePath) {
        const imagePathAssets = `${SOURCE_DIR}/${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${RESOURCE_ASSETS_DIRNAME}/${block.src}`
        const imagePathDocument = `${SOURCE_DIR}/${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${resourcePath.section ? resourcePath.section + "/" : ""}${resourcePath.document}/${block.src}`
        const imagePathDist = `${ASSETS_URL}/${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${RESOURCE_ASSETS_DIRNAME}/${block.src}`

        if (!/^http/.test(block.src.trim())) {
            if (DEPLOY_ENV === "local") {
                block.src = imagePathDist
            } else {
                if (!imageExists(imagePathAssets) && !imageExists(imagePathDocument)) {
                    return null
                }
            }
        }

        return { id: block.id, type: block.type, src: block.src, caption: block.caption }
    },
}
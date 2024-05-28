import { parseSegment } from "../blocks.js"

export const carousel = {
    extension: {
        name: "carousel",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^:{3}\n([\s\S]*?)\n:{3}/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "carousel",
                    raw: match[0],
                    text: match[0].replace(/(^:{3}|:{3})/g, "").trim()
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: collapse`;
        }
    },
    process: async function (block, resourcePath) {
        return { id: block.id, type: block.type, items: await parseSegment(block.text, resourcePath, block.id)}
    },
}
export const slide = {
    extension: {
        name: "slide",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^={3}\n([\s\S]*?)\n={3}/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "slide",
                    raw: match[0],
                    text: match[0].replace(/(^={3}|={3}$)/g, "").trim()
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: collapse`;
        }
    },
    process: async function (block, resourcePath) {
        return { id: block.id, type: block.type, items: await parseSegment(block.text, resourcePath, block.id) }
    },

}
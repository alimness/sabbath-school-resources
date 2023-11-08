import { parseDocument } from "../blocks.js"

export const collapse = {
    extension: {
        name: "collapse",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^ {0,3}(`{3,}(?=[^`\n]*\n))=([^\n]+)\n(?:|([\s\S]*?)\n)(?: {0,3}\1`* *(?=\n|$)|$)/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "collapse",
                    raw: match[0],
                    caption: match[2],
                    text: match[0].replace(/(^```=[^\n]+|```$)/g, "").trim()
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: collapse`;
        }
    },
    process: function (block, resourcePath) {
        return { id: block.id, type: block.type, caption: block.caption, items: parseDocument(block.text, resourcePath, block.id) }
    },
}
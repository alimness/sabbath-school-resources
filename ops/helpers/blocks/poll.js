import { parseDocument } from "../blocks.js"

export const poll = {
    extension: {
        name: "poll",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^ {0,3}(\?{3,}(?=[^?\n]*\n))=([^\n]+)\n(?:|([\s\S]*?)\n)(?: {0,3}\1[?]* *(?=\n|$)|$)/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "poll",
                    raw: match[0],
                    caption: match[2],
                    text: match[0].replace(/(^\?\?\?=[^\n]+|\?\?\?$)/g, "").trim()
                }
            }
        },

        renderer(token) {
            return `TODO: poll`;
        }
    },
    process: async function (block, resourcePath) {
        let list = parseDocument(block.text, resourcePath, block.id)

        if (list.length === 1 && list[0].type === "list") {
            list = list[0].items
            list.map(i => {
                i.type = "poll-option"
            })
        }

        return { id: block.id, type: block.type, caption: block.caption, items: list}
    },
}
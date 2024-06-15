export const question = {
    extension: {
        name: "question",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "question",
                    raw: match[0],
                    text: match[0].replace(/(^`)|(`$)/g, "").trim()
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    },
    process: async function (block, resourcePath) {
        return { id: block.id, type: block.type, markdown: `**${block.text}**` }
    },
}
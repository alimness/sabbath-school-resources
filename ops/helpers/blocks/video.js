export const video = {
    extension: {
        name: "video",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^!\s*(v|video)\s*\[([^\]\n\[]+)\]( *[^\n]*)\n?/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "video",
                    raw: match[0],
                    target: match[2].trim(),
                    caption: match[3] ? match[3].replace(/[\(\)]/g, "").trim(): null,
                };
            }
        },
        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    },
    process: async function (block, resourcePath) {
        return { id: block.id, type: block.type, src: block.target, caption: block.caption }
    },
}
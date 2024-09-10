export const audio = {
    extension: {
        name: "audio",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^!\s*(a|audio)\s*\[([^\]\n\[]+)\]( *[^\n]*)\n?/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "audio",
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
    process: async function (block) {
        return { id: block.id, type: block.type, src: block.target, caption: block.caption }
    },
}
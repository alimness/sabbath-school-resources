export const audio = {
    extension: {
        name: "audio",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^!\s*(a|audio)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*([^\n]*)/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "audio",
                    raw: match[0],
                    target: match[2].trim(),
                    title: match[3] ? match[3].replace(/[\(\)]/g, "").trim() : (match[5] ? match[5].trim() : null),
                    subtitle: match[4] ? match[4].replace(/[\(\)]/g, "").trim() : null,
                };
            }
        },
        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    },
    process: function (block) {
        return { id: block.id, type: block.type, src: block.target, title: block.title, subtitle: block.subtitle }
    },
}
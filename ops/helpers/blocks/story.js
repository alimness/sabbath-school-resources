import { parseSegment } from "../blocks.js"

export const story = {
    extension: {
        name: "story",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^;{3}\n([\s\S]*?)\n;{3}/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "story",
                    raw: match[0],
                    text: match[0].replace(/(^;{3}|;{3})/g, "").trim()
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
export const storySlide = {
    extension: {
        name: "story-slide",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^\^{3}\n([\s\S]*?)\n\^{3}/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "story-slide",
                    raw: match[0],
                    text: match[0].replace(/(^\^{3}|\^{3}$)/g, "").trim()
                }
            }
        },

        renderer(token) {
            // TODO: for web rendering
            return `TODO: collapse`;
        }
    },
    process: async function (block, resourcePath) {
        let items = await parseSegment(block.text, resourcePath, block.id)

        const image = items.find(b => b.type === "image")
        const paragraph = items.find(b => b.type === "paragraph")

        if (!image || !paragraph) { return null }

        const  alignment = image?.style?.image?.storyTextAlign ?? "bottom"

        return { id: block.id, type: block.type, image: image.src, markdown: paragraph.markdown, alignment: alignment, ...(paragraph.style && { style: paragraph.style}) }
    },

}
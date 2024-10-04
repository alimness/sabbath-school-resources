import { ASSETS_URL, DEPLOY_ENV, RESOURCE_ASSETS_DIRNAME } from "../constants.js"

export const audio = {
    extension: {
        name: "audio",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^!\s*(a|audio)\s*\[([^\]\n\[]+)\]( *[^\n]*)\n?/
            const match = rule.exec(src);
            if (match) {
                let caption = match[3] ?? null
                let credits = null
                if (caption) {
                    caption = caption.trim()
                    const creditsRule = /({\s*"credits"\s*:.*})/g
                    const hasCredits = creditsRule.exec(caption)

                    if (hasCredits) {
                        try {
                            credits = JSON.parse(hasCredits[1])
                        } catch (e) {
                            console.error(e)
                        }

                        caption = caption.replace(creditsRule, '').trim()
                        caption = caption.length ? caption : null
                    }
                }

                return {
                    type: "audio",
                    raw: match[0],
                    target: match[2].trim(),
                    caption,
                    credits,
                };
            }
        },
        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    },
    process: async function (block, resourcePath) {
        const audioPathDist = `${ASSETS_URL}/${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${RESOURCE_ASSETS_DIRNAME}/${block.target}`

        let src = block.target

        if (!/^http/.test(block.target.trim())) {
            if (DEPLOY_ENV === "local") {
                src = audioPathDist
            }
        }

        return { id: block.id, type: block.type, src, caption: block.caption, credits: block.credits }
    },
}
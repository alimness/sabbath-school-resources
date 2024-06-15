import { getBibleData } from "../bible.js"
import { getEGWData } from "../egw.js"
import crypto from "crypto"
import { parseSegment } from "../blocks.js"

export const paragraph = {
    extension: {},
    process: async function (block, resourcePath, depth) {
        let text = block.text.trim()

        const bibleData = depth !== "no-bible" ? getBibleData(resourcePath, text) : null

        let r =  { id: block.id, type: block.type, markdown: text }

        if (bibleData && bibleData.bibleData.length) {
            r["markdown"] = bibleData.text
            let documentIndex = `${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/content/${resourcePath.section ? resourcePath.section + "/" : ""}${resourcePath.document}`

            r.data = {
                bible: {
                    id: crypto.createHash("sha256").update(`${documentIndex}-${r.id}-excerpt-0`).digest("hex"),
                    type: "excerpt",
                }
            }
            r.data.bible.options = [...new Set(bibleData.bibleData.map(obj => obj.name))];
            r.data.bible.items = []

            for (const [index, passageArray] of bibleData.bibleData.entries()) {
                let item = {
                    id: crypto.createHash("sha256").update(`${documentIndex}-${r.data.bible.id}-${block.type}-${index}`).digest("hex"),
                    option: passageArray.name,
                    type: "excerpt-item"
                }
                let markdown = ""
                for (let verse of Object.keys(passageArray.verses)) {
                    markdown += passageArray.verses[verse] + "\n\n"
                }
                markdown = markdown.replace(/\n\n$/mg, '')

                item.items = await parseSegment(markdown, resourcePath, item.id)

                r.data.bible.items.push(item)
            }
        }

        const egwData = await getEGWData(resourcePath, r.markdown)

        if (Object.keys(egwData.data.egw).length) {
            if (!r["data"]) { r["data"] = {}}

            r["data"]["egw"] = egwData.data.egw
            r["markdown"] = egwData.output
        }

        return r
    },
}
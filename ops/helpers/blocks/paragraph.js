import { getBibleData } from "../bible.js"
import { getEGWData } from "../egw.js"

export const paragraph = {
    extension: {},
    process: async function (block, resourcePath) {
        let text = block.text.trim()

        const bibleData = getBibleData(resourcePath, text)

        let r =  { id: block.id, type: block.type, markdown: text }
        if (bibleData.bibleData.length) {
            r["data"] = { bible: bibleData.bibleData }
            r["markdown"] = bibleData.text
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
import bibleSearchBCV from "adventech-bible-tools/bible_tools_bcv.js"
import { getLanguageInfoSync } from "../../deploy/deploy-languages.js"

let languageInfoGlobal = {}

export const paragraph = {
    extension: {},
    process: async function (block, resourcePath) {
        let text = block.text
        let bibleData = []

        let bibleVersionsArray = []
        if (languageInfoGlobal[resourcePath.language]) {
            bibleVersionsArray = bibleVersionsArray.concat(languageInfoGlobal[resourcePath.language].bible ?? [])
        } else {
            const languageInfo = getLanguageInfoSync(resourcePath.language)
            languageInfoGlobal[languageInfo.code] = languageInfo
            bibleVersionsArray = bibleVersionsArray.concat(languageInfo.bible ?? [])
        }

        for (let bibleVersion of bibleVersionsArray) {
            let bibleCopyright = null
            let bibleVersionName = bibleVersion

            if (bibleVersion.name) {
                bibleCopyright = bibleVersion.copyright;
                bibleVersionName = bibleVersion.name;
            }

            let bibleSearchResult

            try {
                bibleSearchResult = bibleSearchBCV.search(resourcePath.language, bibleVersionName, text, true)
                if (!bibleData.length) {
                    text = bibleSearchResult.output
                }
            } catch (e) {
                bibleSearchResult = null
            }

            if (!bibleSearchResult) continue;

            if (bibleSearchResult.verses.length) {
                let newBibleData = {}
                newBibleData["name"] = bibleVersionName.toUpperCase()
                newBibleData["verses"] = bibleSearchResult.verses.reduce(function (result, item) {
                    let key = Object.keys(item)[0];
                    result[key] = item[key];
                    return result;
                }, {});
                bibleData.push(newBibleData)
            }

        }
        let r =  { id: block.id, type: block.type, markdown: text.trim() }
        if (bibleData.length) {
            r["data"] = { bible: bibleData }
        }
        return r
    },
}
import crypto from "crypto"
import bibleSearchBCV from "adventech-bible-tools/bible_tools_bcv.js"
import frontMatter from "front-matter"
import yaml from "js-yaml"
import fs from "fs-extra"
import { marked } from "marked"
import { validate as jsonSchemaValidate } from "jsonschema"
import { isImageValid, parseResourcePath } from "./helpers.js"
import { SOURCE_DIR } from "./constants.js";

let languageInfoGlobal = {}

const sspmCommonExtension = function (type) {
    let token = {
        "reference": /^\{\s*(#|ref)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*\}([^\n]*)/,
        "audio": /^!\s*(a|audio)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*([^\n]*)/,
        "video": /^!\s*(v|video)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*([^\n]*)/
    }

    if (Object.keys(token).indexOf(type) < 0) return null

    return {
        name: type,
        level: 'block',
        tokenizer(src, tokens) {
            const rule = token[type]
            const match = rule.exec(src);
            if (match) {
                return {
                    type: type,
                    raw: match[0],
                    target: match[2].trim(),
                    title: match[3] ? match[3].replace(/[\(\)]/g, '').trim() : (match[5] ? match[5].trim() : null),
                    subtitle: match[4] ? match[4].replace(/[\(\)]/g, '').trim() : null,
                };
            }
        },
        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    }
}
const sspmCollapse = {
    name: 'collapse',
    level: 'block',
    tokenizer(src, tokens) {
        const rule = /^ {0,3}(`{3,}(?=[^`\n]*\n)|~{3,})=([^\n]+)\n(?:|([\s\S]*?)\n)(?: {0,3}\1[~`]* *(?=\n|$)|$)/
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'collapse',
                raw: match[0],
                caption: match[2],
                text: match[0].replace(/(^```=[^\n]+|```$)/g, '').trim()
            }
        }
    },

    renderer(token) {
        // TODO: for web rendering
        return `TODO: collapse`;
    }

}
const sspmQuestion = {
    name: 'question',
    level: 'block',
    tokenizer(src, tokens) {
        const rule = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'question',
                raw: match[0],
                text: match[0].replace(/(^`)|(`$)/g, '').trim()
            }
        }
    },

    renderer(token) {
        // TODO: for web rendering
        return `TODO: reference`;
    }
}
const sspmImage = {
    name: 'image',
    level: 'block',
    tokenizer(src, tokens) {
        const rule = /^({\s*"?sspmStyle"?\s*:.*})?\s*!\[([^\[\]]+)\]\(?([^\[\]\)]+)?\)?/
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'image',
                raw: match[0],
                src: match[3] ? match[3] : match[2],
                caption: match[3] ? match[2]: match[1] || null,
            }
        }
    },

    renderer(token) {
        // TODO: for web rendering
        return `TODO: image`;
    }
}
const styleSchema = {
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "rounded": {"type": "boolean"},
        "expandable": {"type": "boolean"},
        "position": {"type": "string", "enum": ["start", "center", "end"]},
        "size": {"type": "string", "enum": ["small", "medium", "large"]},
        "fullBleed": {"type": "boolean"},
    }
}

marked.use({
    extensions: [
        sspmQuestion,
        sspmCollapse,
        sspmImage,
        sspmCommonExtension('reference'),
        sspmCommonExtension('audio'),
        sspmCommonExtension('video'),
    ]
});

let getLanguageInfo = async function (language) {
    const languageInfo = yaml.load(fs.readFileSync(`${SOURCE_DIR}/${language}/info.yml`, 'utf8'));
    languageInfoGlobal[languageInfo.code] = languageInfo
    return languageInfo
}

// TODO: check if reference processing works
let processReference = function (block) {
    let referenceTargetPath = parseResourcePath(block.target)

    let reference = { "scope": "resource" }

    if (!referenceTargetPath.language || !referenceTargetPath.type || !referenceTargetPath.name) {
        return false
    }

    if (referenceTargetPath.section && !referenceTargetPath.document) {
        if (fs.pathExistsSync(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}/content/${referenceTargetPath.section}.md`)) {
            referenceTargetPath.document = referenceTargetPath.section
            referenceTargetPath.section = null
        }
    }

    if (referenceTargetPath.document) {
        reference.scope = "document"
    }

    if (block.title) {
        return reference
    }

    try {
        const resource = yaml.load(fs.readFileSync(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}/info.yml`, 'utf8'));

        if (reference.scope === "document") {
            const document = fs.readFileSync(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}/content/${referenceTargetPath.section ? `${referenceTargetPath.section}/` : ''}${referenceTargetPath.document}.md`, 'utf8');
            const documentFrontMatter = frontMatter(document)

            reference.title = documentFrontMatter.attributes.title
            reference.subtitle = resource.title
        } else {
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}`
            reference.title = resource.title
        }

        return reference
    } catch (e) {
        return null
    }
}

let parseBlock = function (block, resourcePath, index, parentId) {
    let blockReturn = {}
    let sspmOptionsRegex = /({\s*"?sspmStyle"?\s*:.*})/g
    let sspmOptionsMatch = block.raw.match(sspmOptionsRegex)

    let sspmSuperscript = /(~|<sup>)(\d*)(~|<\/sup>)/img
    let sspmSuperscriptMatch = block.raw.match(sspmSuperscript)

    let sspmSuperscriptReplacement = function (str) {
        const unicodeMap = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']
        let ret = str
        for (let i = 0; i <= 9; i++) {
            ret = ret.replace(new RegExp(`${i}`, 'gm'), unicodeMap[i])
        }
        return ret
    }

    if (sspmSuperscriptMatch && sspmSuperscriptMatch.length > 0) {
        for (let match of sspmSuperscriptMatch) {
            let unicodeNumber = sspmSuperscriptReplacement(match.replace(sspmSuperscript, "$2"))
            block.text = block.text.replace(match, unicodeNumber).trim()
        }
    }

    if (sspmOptionsMatch && sspmOptionsMatch[0]) {
        try {
            let sspmOptions = JSON.parse(sspmOptionsMatch[0])
            let validateResult = jsonSchemaValidate(sspmOptions.sspmStyle, styleSchema)
            if (validateResult.errors.length < 1) {
                blockReturn.style = {...sspmOptions.sspmStyle}

                let replacer = block.type === "image" ? block.raw : block.text

                block.text = replacer.replace(sspmOptionsRegex, '').trim()
            }
        } catch (e) {
            console.error(e)
        }
    }

    let documentIndex = `${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/content/${resourcePath.section ? resourcePath.section + "/" : ""}${resourcePath.document}`

    block.id = crypto.createHash('sha256').update(
        `${documentIndex}-${parentId}-${block.type}-${index}`
    ).digest('hex')

    if (/^en\/study\/test\/content\/blocks/.test(documentIndex)) {
        console.log(block)
    }

    switch(block.type) {
        case "blockquote": {
            let blockquote = { id: block.id, type: block.type }
            // memory-verse
            const memoryVerseRegex = /<p>([^<>]+)<\/p>/g
            let memoryVerse = memoryVerseRegex.exec(block.text)
            if (memoryVerse) {
                block.text = block.text.replace(memoryVerseRegex, '').trim()
                blockquote.memoryVerse = true
                blockquote.caption = memoryVerse[1]
            }

            // citation
            const citationRegex = /<cite>([^<>]+)<\/cite>/g
            let citation = citationRegex.exec(block.text)
            if (citation) {
                block.text = block.text.replace(citationRegex, '').trim()
                blockquote.caption = citation[1]
                blockquote.citation = true
            }

            return {...blockquote, items: parseDocument(block.text, resourcePath, block.id), ...blockReturn }
        }
        case "audio": {
            return { id: block.id, type: block.type, src: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn }
        }
        case "video": {
            return { id: block.id, type: block.type, src: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn }
        }
        case "image": {
            let imageValid = isImageValid(block.src, resourcePath)
            if (imageValid.valid) {
                block.src = imageValid.src
            }
            return { id: block.id, type: block.type, src: block.src, caption: block.caption, ...blockReturn }
        }
        case "question": {
            return { id: block.id, type: block.type, markdown: block.text, ...blockReturn }
        }
        case "collapse": {
            return { id: block.id, type: block.type, caption: block.caption, items: parseDocument(block.text, resourcePath, block.id), ...blockReturn }
        }
        case "hr": {
            return { id: block.id, type: block.type, ...blockReturn }
        }
        case "reference": {
            let processedReference = processReference(block)
            if (!processedReference) return null

            return { id: block.id, type: block.type, target: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn, ...processedReference}
        }
        case "paragraph": {
            let text = block.text
            let bibleData = []

            let bibleVersionsArray = []
            if (languageInfoGlobal[resourcePath.language]) {
                bibleVersionsArray = bibleVersionsArray.concat(languageInfoGlobal[resourcePath.language].bible ?? [])
            } else {
                bibleVersionsArray = bibleVersionsArray.concat(getLanguageInfo(resourcePath.language).bible ?? [])
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
            let r =  { id: block.id, type: block.type, markdown: text.trim(), ...blockReturn }
            if (bibleData.length) {
                r["data"] = { bible: bibleData }
            }
            return r
        }
        case "heading": {
            return { id: block.id, type: block.type, markdown: block.text.trim(), depth: block.depth, ...blockReturn }
        }
        case "list": {
            let blockData = { id: block.id, type: block.type, items: [], ordered: block.ordered, start: block.start || 0 }

            for (let [index, listItem] of block.items.entries()) {
                for (let token of listItem.tokens) {
                    if (token.type === "text") {
                        blockData.items.push({
                            "type": "list-item",
                            "markdown": token.text.trim()
                        })
                    } else {
                        blockData.items.push(
                            parseBlock(token, resourcePath, index, block.id)
                        )
                    }
                }
            }

            // Appeal
            if (block.items.length === 1 && block.items[0].task) {
                return blockData = { id: block.id, type: "appeal", markdown: block.items[0].text }
            }

            // Checklist
            if (block.items.length > 1) {
                let multiAppeal = true
                for (let item of block.items) {
                    if (item.type !== "list_item") {
                        multiAppeal = false
                        break
                    }

                    if (item.checked) {
                        multiAppeal = false
                        break
                    }

                    if (!item.task) {
                        multiAppeal = false
                        break
                    }
                }
                if (multiAppeal) {
                    return blockData = { ...blockData, type: "checklist" }
                }
            }

            // Multiple choice

            if (block.items.length > 1) {
                let multipleChoice = true
                let checkedNum = 0
                let answer
                for (let [i, item] of block.items.entries()) {
                    if (item.type !== "list_item") {
                        multipleChoice = false
                        break
                    }

                    if (item.checked) {
                        checkedNum++
                        answer = i
                        break
                    }

                    if (!item.task) {
                        multipleChoice = false
                        break
                    }
                }
                if (multipleChoice && checkedNum === 1) {
                    return blockData = { ...blockData, answer: answer, type: "multiple-choice" }
                }
            }

            return blockData
        }
    }
}

let parseDocument = function (document, resourcePath, parentId) {
    const blocks = marked.lexer(document).filter(b => b.type !== 'space')
    let blocksData = []

    for (let [index, block] of blocks.entries()) {
        let indexHash = blocks.filter(b => b.type === block.type).findIndex(b => b === block)
        let blockData = parseBlock(block, resourcePath, indexHash >= 0 ? indexHash : index, parentId ?? 'root')

        if (blockData) {
            blocksData.push(blockData)
        }
    }

    return blocksData
}

export {
    marked,
    parseDocument
}
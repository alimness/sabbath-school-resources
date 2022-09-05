#!/usr/bin/env node

const argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -e [string]')
    .describe('e', 'The deployment environment. Either stage or prod')
    .default('e', 'stage')
    .alias('e', 'env')
    .argv;

// modules

const { fdir } = require("fdir")
const fs = require("fs-extra")
const yaml = require('js-yaml')
const path = require('path')
const frontMatter = require('front-matter')
const marked = require('marked')
const bibleSearchBCV = require('adventech-bible-tools/bible_tools_bcv');

// consts

const DIST_DIR = "./dist"
const API_PREFIX = "/api/v2/"
const API_DIST = `${DIST_DIR}/${API_PREFIX}`
const API_URL = `https://sabbath-school${argv.e === 'prod' ? '' : '-stage' }.adventech.io`

const sspmCommonExtension = function (type) {
    let token = {
        "reference": /^\{\s*(#|ref)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*\}([^\n]*)/,
        "audio": /^\{\s*(a|audio)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*\}([^\n]*)/,
        "video": /^\{\s*(v|video)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*\}([^\n]*)/
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
        const rule = /^!?\[([^\[\]]+)\]\(?([^\[\]\)]+)?\)?/
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'image',
                raw: match[0],
                src: match[1],
                caption: match[2] || null,
            }
        }
    },

    renderer(token) {
        // TODO: for web rendering
        return `TODO: image`;
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

let parseResourcePath = function (resourcePath) {
    if (/^\.\/src\//.test(resourcePath)) {
        resourcePath = resourcePath.replace(/^\.\/src\//, '')
    }
    let pathRegExp = /^([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?\/?([^\/]+)?/mg,
        matches = pathRegExp.exec(resourcePath),
        info = {};

    try {
        info.language = matches[1] || null;
        info.type = matches[2] || null;
        info.name = matches[3] || null;
        info.section = (matches[4] && matches[5] && !/\.md$/.test(matches[5])) ? matches[5] : null;
        info.document = matches[6] ? matches[6] : (matches[5] && /\.md$/.test(matches[5])) ? matches[5] : null;
        if (info.document) { info.document = info.document.replace(".md", "") }
    } catch (e) {
        console.error(e)
    }

    return info;
}

let getResourcesGlob = function (resourceType) {
    return new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(3)
        .glob(`**/${resourceType}/**/info.yml`)
        .crawl(`./src`)
        .sync();
}

let deployAssets = function (resourceType) {
    let assets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .onlyDirs()
        .withMaxDepth(3)
        .filter((path, isDirectory) => path.endsWith("assets/"))
        .crawl(`./src`)
        .sync();

    for (let asset of assets) {
        fs.copySync(`${asset}`, `${asset.replace(/^\.\/src\//g, `${API_DIST}/`)}`)
    }
}

let deployLanguages = function () {
    let languages = new fdir()
        .withRelativePaths()
        .withMaxDepth(1)
        .glob("**/info.yml")
        .crawl("./src/")
        .sync();

    let languagesInfo = []

    for (let language of languages) {
        try {
            const languageInfo = yaml.load(fs.readFileSync(`./src/${language}`, 'utf8'));
            languagesInfo.push(languageInfo)
        } catch (e) {
            console.error(e);
        }
    }

    fs.outputFileSync(`${API_DIST}/resources/index.json`, JSON.stringify(languagesInfo))
}

let deployResources = function (resourceType) {
    // find info.yml of each resource
    // create ID & the rest of the structure
    let resources = getResourcesGlob(resourceType)

    let allResources = {}

    for (let resource of resources) {
        try {
            const resourceInfo = yaml.load(fs.readFileSync(`./src/${resource}`, 'utf8'));
            const resourcePath = parseResourcePath(resource)

            deployResourceAssets(`./src/${resourcePath.language}/${resourceType}/${resourcePath.name}`, `${API_DIST}/${resourcePath.language}/${resourceType}/${resourcePath.name}`)

            if (fs.pathExistsSync(`./src/${resourcePath.language}/${resourceType}/${resourcePath.name}/cover.png`)) {
                resourceInfo.cover = `${API_URL}${API_PREFIX}${resourcePath.language}/${resourceType}/${resourcePath.name}/assets/img/cover.png`
            }

            if (fs.pathExistsSync(`./src/${resourcePath.language}/${resourceType}/${resourcePath.name}/splash.png`)) {
                resourceInfo.splash = `${API_URL}${API_PREFIX}${resourcePath.language}/${resourceType}/${resourcePath.name}/assets/img/splash.png`
            }

            resourceInfo.id = resourcePath.name
            resourceInfo.type = "resource"
            resourceInfo.view = resourceInfo.view ?? "splash"

            // resourceInfo.kind = resourceInfo.kind ?? "book"
            resourceInfo.backgroundColor = resourceInfo.backgroundColor ?? "#7e7e7e"
            resourceInfo.textColor = resourceInfo.textColor ?? "#ffffff"

            if (!allResources[resourcePath.language]) {
                allResources[resourcePath.language] = []
            }
            allResources[resourcePath.language].push(resourceInfo)

            // Deploy
            fs.outputFileSync(`${API_DIST}/${resourcePath.language}/${resourceType}/${resourcePath.name}/index.json`, JSON.stringify(resourceInfo))
        } catch (e) {
            console.error(e);
        }
    }

    for (let language of Object.keys(allResources)) {
        let resourcesOutput = []

        if (fs.pathExistsSync(`./src/${language}/${resourceType}/groups.yml`)) {
            let groups = yaml.load(fs.readFileSync(`./src/${language}/${resourceType}/groups.yml`, 'utf8'));
            let allIds = []

            for (let orderItem of groups) {
                if (!orderItem.group) {
                    const r = allResources[language].find(r => r.id === orderItem)
                    if (r) {
                        resourcesOutput.push(r)
                        allIds.push(r.id)
                    }
                } else {
                    if (!orderItem.resources || !orderItem.resources.length) continue

                    let groupedResources = {
                        type: "group",
                        title: orderItem.group,
                        resources: [],
                        view: orderItem.view || "splash"}

                    if (orderItem.cover && fs.pathExistsSync(`./src/${language}/${resourceType}/${orderItem.cover}`)) {
                        groupedResources.cover = `${API_URL}${API_PREFIX}${language}/${resourceType}/${orderItem.cover}`
                    }

                    for (let groupItem of orderItem.resources) {
                        const r = allResources[language].find(r => r.id === groupItem)
                        if (r) {
                            groupedResources.resources.push(r)
                            allIds.push(r.id)
                        }
                    }
                    if (groupedResources.resources.length) {
                        resourcesOutput.push(groupedResources)
                    }
                }
            }
            let rest = allResources[language].filter(r => !allIds.includes(r.id))
            resourcesOutput = resourcesOutput.concat(rest)
        } else {
            resourcesOutput = allResources[language]
        }

        fs.outputFileSync(`${API_DIST}/${language}/${resourceType}/index.json`, JSON.stringify(resourcesOutput))
    }
}

let deployResourceAssets = function (resource, outputPath) {
    try {
        if (fs.pathExistsSync(`${resource}/cover.png`)) {
            fs.copySync(`${resource}/cover.png`, `${outputPath}/assets/img/cover.png`)
        }

        if (fs.pathExistsSync(`${resource}/splash.png`)) {
            fs.copySync(`${resource}/splash.png`, `${outputPath}/assets/img/splash.png`)
        }

        if (fs.pathExistsSync(`${resource}/img`)) {
            fs.copySync(`${resource}/img`, `${outputPath}/assets/img`)
        }

        if (fs.pathExistsSync(`${resource}/fonts`)) {
            fs.copySync(`${resource}/fonts`, `${outputPath}/assets/fonts`)
        }
        // let resourceId = resourcePath.name
        // implement asset dir structure
    } catch (e) {
        console.error(e);
    }
}

let deployDocuments = function (resourceType) {
    let resources = getResourcesGlob(resourceType)

    for (let resource of resources) {
        try {
            const resourcePath = parseResourcePath(resource)

            let sections = new fdir()
                .onlyDirs()
                .withRelativePaths()
                .withMaxDepth(1)
                .crawl(`./src/${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/content/`)
                .sync();

            let sectionsData = []

            // TODO: Manage sections in YAML potentially
            for (let section of sections) {
                const sectionPath = parseResourcePath(`${section}`)

                let sectionData = {
                    "id": sectionPath.section || "root",
                    "title": null,
                    "documents": [],
                }

                if (sectionData.id !== "root") {
                    try {
                        const sectionInfo = yaml.load(fs.readFileSync(`${section}/info.yml`, 'utf8'));
                        sectionData.title = sectionInfo.title
                    } catch (e) {
                        console.error(e);
                    }
                }

                let documents = new fdir()
                    .withRelativePaths()
                    .withMaxDepth(0)
                    .glob("**/*.md")
                    .crawl(`${section}`)
                    .sync();

                for (let document of documents) {
                    const documentPath = parseResourcePath(`${section}${document}`)
                    let documentData = {
                        "id": documentPath.document
                    }

                    try {
                        const documentInfo = fs.readFileSync(`${section}/${document}`, 'utf8');
                        const documentInfoFrontMatter = frontMatter(documentInfo)
                        documentData = { ...documentInfoFrontMatter.attributes}

                        let documentDataBlocks = {...documentData, blocks: parseDocument(documentInfoFrontMatter.body, resourcePath)}

                        // Getting thumbnail
                        let image = documentDataBlocks.blocks.find(b => b.type === "image")
                        if (image && image.src) {
                            documentData.image = image.src
                            documentDataBlocks.image = image.src
                        }

                        fs.outputFileSync(`${API_DIST}/${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/content/${sectionPath.section ?? ""}/${document.replace(/\.md$/, '')}/index.json`, JSON.stringify(documentDataBlocks))

                    } catch (e) {
                        console.error(e);
                    }

                    sectionData.documents.push(documentData)
                }

                sectionsData.push(sectionData)
            }

            fs.outputFileSync(`${API_DIST}/${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/sections/index.json`, JSON.stringify(sectionsData))
        } catch (e) {
            console.error(e);
        }
    }
}

let processReference = function (block) {
    let referenceTargetPath = parseResourcePath(block.target)
    let reference = { "scope": "resource" }
    if (!referenceTargetPath.language || !referenceTargetPath.type || !referenceTargetPath.name) {
        return false
    }

    if (referenceTargetPath.document) {
        reference.scope = "document"
    }

    if (block.title) {
        return reference
    }

    try {
        const resource = yaml.load(fs.readFileSync(`./src/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}/info.yml`, 'utf8'));

        if (reference.scope === "document") {
            const document = fs.readFileSync(`./src/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}/content/${referenceTargetPath.section ? `${referenceTargetPath.section}/` : ''}${referenceTargetPath.document}.md`, 'utf8');
            const documentFrontMatter = frontMatter(document)

            reference.title = documentFrontMatter.attributes.title
            reference.subtitle = resource.title
        } else {
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.name}`
            reference.title = resource.title
        }

        return reference
    } catch (e) {
        console.log(e)
        return null
    }
}

let parseBlock = function (block, resourcePath) {
    // console.log(JSON.stringify(block, null, 2))
    let blockReturn = {}
    let sspmOptionsRegex = /({\s*"?sspm"?\s*:.*})/g
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
            blockReturn.data = {...sspmOptions.sspm}
            block.text = block.text.replace(sspmOptionsRegex, '').trim()
        } catch (e) {
            console.error(e)
        }
    }

    switch(block.type) {
        case "blockquote": {
            let blockquote = { type: block.type }
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

            return {...blockquote, items: parseDocument(block.text), ...blockReturn }
        }
        case "audio": {
            return { type: block.type, src: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn }
        }
        case "video": {
            return { type: block.type, src: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn }
        }
        case "image": {
            if (!/^http/.test(block.src.trim())) {
                let prefixes = [
                    `/${resourcePath.name}/`,
                    `/${resourcePath.name}/assets/`,
                    `/${resourcePath.name}/assets/img/`,
                    `/assets/`,
                    `/assets/img/`,
                ]

                let found = false

                for (let prefix of prefixes) {
                    if (fs.pathExistsSync(`./src/${resourcePath.language}/${resourcePath.type}${prefix}${block.src}`)) {
                        block.src = `${API_URL}${API_PREFIX}${resourcePath.language}/${resourcePath.type}${prefix}${block.src}`
                        found = true
                        break
                    }
                }

                if (!found) {
                    return null
                }
            }

            return { type: block.type, src: block.src, caption: block.caption, ...blockReturn }
        }
        case "question": {
            return { type: block.type, markdown: block.text, ...blockReturn }
        }
        case "collapse": {
            return { type: block.type, caption: block.caption, items: parseDocument(block.text), ...blockReturn }
        }
        case "hr": {
            return { type: block.type, ...blockReturn }
        }
        case "reference": {
            let processedReference = processReference(block)
            if (!processedReference) return null

            return { type: block.type, target: block.target, title: block.title, subtitle: block.subtitle, ...blockReturn, ...processedReference}
        }
        case "paragraph": {
            let text = block.text
            let bibleSearchResult
            try {
                bibleSearchResult = bibleSearchBCV.search("en", "nkjv", text, true)
                text = bibleSearchResult.output
            } catch (e) {
                console.error(e)
            }

            return { type: block.type, markdown: text.trim(), ...blockReturn }
        }
        case "heading": {
            return { type: block.type, markdown: block.text.trim(), depth: block.depth, ...blockReturn }
        }
        case "list": {
            let blockData = { type: block.type, items: [], ordered: block.ordered, start: block.start || 0 }

            for (let listItem of block.items) {
                for (let token of listItem.tokens) {
                    if (token.type === "text") {
                        blockData.items.push({
                            "type": "list-item",
                            "markdown": token.text.trim()
                        })
                    } else {
                        blockData.items.push(
                            parseBlock(token)
                        )
                    }
                }
            }

            // Appeal
            if (block.items.length === 1 && block.items[0].task) {
                return blockData = { type: "appeal", markdown: block.items[0].text }
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

let parseDocument = function (document, resourcePath) {
    const blocks = marked.lexer(document);
    // console.log(JSON.stringify(blocks, null, 2))
    let blocksData = []

    for (let block of blocks) {
        if (block.type === "space") continue

        let blockData = parseBlock(block, resourcePath)

        if (blockData) {
            blocksData.push(blockData)
        }
    }
    return blocksData
}

deployAssets()
deployLanguages()
deployResources("pm")
deployResources("devo")
deployDocuments("pm")
deployDocuments("devo")
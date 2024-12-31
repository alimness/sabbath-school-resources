#!/usr/bin/env node
"use strict"

import crypto from "crypto"
import yaml from "js-yaml"
import fs from "fs-extra"
import frontMatter from "front-matter"
import { fdir } from "fdir"
import { isMainModule, parseResourcePath, deepMerge, arg } from "../helpers/helpers.js"
import { parseSegment } from "../helpers/blocks.js"
import { database } from "../helpers/firebase.js"
import {
    SOURCE_DIR,
    API_DIST,
    SEGMENT_TYPES,
    DEPLOY_ENV,
    GLOBAL_ASSETS_DIR,
    ASSETS_URL,
    RESOURCE_PDF_FILENAME,
    DOCUMENT_INFO_FILENAME, MEDIA_URL, SEGMENT_FILENAME_EXTENSION, RESOURCE_ASSETS_DIRNAME, MEDIA_PDF_URL_LEGACY
} from "../helpers/constants.js"
import { SEGMENT_DEFAULT_BLOCK_STYLES } from "../helpers/styles.js"

let getDocumentInfoYml = async function (document) {
    const documentInfo = yaml.load(fs.readFileSync(document, "utf8"));
    const documentPathInfo = parseResourcePath(document)

    documentInfo.id = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`
    documentInfo.resourceId = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}`
    documentInfo.resourceIndex = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}`
    documentInfo.index = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`
    documentInfo.name = `${documentPathInfo.document}`

    if (documentInfo.start_date) {
        documentInfo.startDate = documentInfo.start_date
        delete documentInfo.start_date
    }

    if (documentInfo.end_date) {
        documentInfo.endDate = documentInfo.end_date
        delete documentInfo.end_date
    }

    if (/^\d+$/.test(documentInfo.name)) {
        documentInfo.sequence = `${parseInt(documentInfo.name)}`
    } else {
        documentInfo.sequence = `•`
    }

    if (documentInfo.chips) {
        documentInfo.showSegmentChips = true
        delete documentInfo.chips
    }

    let documentTitleForSplash = documentPathInfo.title.replace(/-er$/, '').replace(/-(ay|inv)$/, '-cq')

    if (!documentInfo.cover && fs.pathExistsSync(`${GLOBAL_ASSETS_DIR}/images/${documentPathInfo.type}/${documentTitleForSplash}/${documentPathInfo.section ? documentPathInfo.section + "/" : ""}${documentPathInfo.document}/cover.png`)) {
        documentInfo.cover = `${ASSETS_URL}/assets/images/${documentPathInfo.type}/${documentTitleForSplash}/${documentPathInfo.section ? documentPathInfo.section + "/" : ""}${documentPathInfo.document}/cover.png`
    }

    return documentInfo
}

let getSegmentInfo = async function (segment, processBlocks = false, append = "") {
    let segmentFile = fs.readFileSync(segment, "utf8")

    const segmentInfoFrontMatter = frontMatter(segmentFile)
    const segmentPathInfo = parseResourcePath(segment)

    const egwNotesRegex = /\n#{2,}\s*Additional Reading[\s\S]*/g // = #### Additional Reading
    const match = segmentInfoFrontMatter.body.match(egwNotesRegex)

    if (match) {
        const foundLines = match[0]
        const replacement = `\n\`\`\`=${foundLines.replace(/\n#{2,}\s*/, '').trim()}\n\`\`\``
        segmentInfoFrontMatter.body = segmentInfoFrontMatter.body.replace(egwNotesRegex, replacement)
    }
    segmentInfoFrontMatter.body += append

    const segmentInfo = {
        ...segmentInfoFrontMatter.attributes,
    }

    let segmentFilterForType = {
        "block": (b) => b.type !== "space",
        "story": (b) => {
            return b.type === "story"
        }
    }

    if (!segmentInfo.type) {
        segmentInfo.type = SEGMENT_TYPES.BLOCK
    }

    segmentInfo.id = `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}-${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}-${segmentPathInfo.segment}`
    segmentInfo.resourceId = `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}`
    segmentInfo.index = `${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}/${segmentPathInfo.segment}`
    segmentInfo.name = `${segmentPathInfo.segment}`

    if (segmentInfo.pdf) {
        segmentInfo.type = SEGMENT_TYPES.PDF
        for (let pdf of segmentInfo.pdf) {
            pdf.id = crypto.createHash("sha256").update(
                `${segmentInfo.id}-${pdf.src}`
            ).digest("hex")
        }
    }

    if (segmentInfo.video) {
        segmentInfo.type = SEGMENT_TYPES.VIDEO

        for (let video of segmentInfo.video) {
            video.id = crypto.createHash("sha256").update(
                `${segmentInfo.id}-${video.src}`
            ).digest("hex")
        }
    }

    if (processBlocks) {
        segmentInfo.blocks = await parseSegment(segmentInfoFrontMatter.body, segmentPathInfo, "root", 1, segmentFilterForType[segmentInfo.type])
    }

    if (DEPLOY_ENV === "local") {
        if (segmentInfo.cover && !/^http/.test(segmentInfo.cover)) {
            segmentInfo.cover = `${MEDIA_URL}/${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${segmentInfo.cover}`
        }

        if (segmentInfo.background && !/^http/.test(segmentInfo.background)) {
            segmentInfo.background = `${MEDIA_URL}/${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${segmentInfo.background}`
        }

        if (segmentInfo.audio && segmentInfo.audio.src && !/^http/.test(segmentInfo.audio.src)) {
            segmentInfo.audio.src = `${MEDIA_URL}/${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${segmentInfo.audio.src}`
        }
    }

    return segmentInfo
}

let processPDFOnlyResource = async function (resource, returnOnly) {
    let resourcePathInfo = parseResourcePath(resource)
    const pdfFile = yaml.load(fs.readFileSync(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_PDF_FILENAME}`, "utf8"))
    const documents = []
    const pdfsForDocument = {}

    for (let [i, pdf] of pdfFile.pdf.entries()) {
        if (!pdf.title || !pdf.src) { continue }

        if (!pdf.target) {
            pdf.target = `${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${String(i+1).padStart(2, '0')}`
        }

        let targetForId = pdf.target

        if (resourcePathInfo.type === "ss") {
            targetForId = targetForId.replace(/^([a-z]{2,3})\/ss\//, '$1/')
        }

        pdf.id = crypto.createHash('sha256').update(targetForId + pdf.src).digest('hex')
        pdf.targetIndex = pdf.target.replace(/\//g, '-')
        pdf.src = `${MEDIA_URL}/pdf/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${pdf.id}/${pdf.id}.pdf`

        if (resourcePathInfo.type === "ss") {
            pdf.src = `${MEDIA_PDF_URL_LEGACY}/pdf/${resourcePathInfo.language}/${resourcePathInfo.title}/${pdf.id}/${pdf.id}.pdf`
        }

        if (!pdfsForDocument[pdf.target]) {
            pdfsForDocument[pdf.target] = [pdf]
        } else {
            pdfsForDocument[pdf.target].push(pdf)
        }
    }

    for (let pdfTarget of Object.keys(pdfsForDocument)) {
        let pdfs = pdfsForDocument[pdfTarget]
        if (!pdfs.length) continue
        const documentPathInfo = parseResourcePath(`${pdfs[0].target}/${DOCUMENT_INFO_FILENAME}`)
        const segmentPathInfo = parseResourcePath(`${pdfs[0].target}/${documentPathInfo.document}.md`)

        const documentInfo = {
            title: pdfs[0].title,
            id: `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`,
            resourceId: `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}`,
            resourceIndex: `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}`,
            index: `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`,
            name: `${documentPathInfo.document}`,
        }

        if (pdfs[0].start_date) {
            documentInfo.startDate = pdfs[0].start_date
        }

        if (pdfs[0].end_date) {
            documentInfo.endDate = pdfs[0].end_date
        }

        pdfs = pdfs.map(pdf => { delete pdf['start_date']; delete pdf['end_date']; return pdf } )

        documentInfo.segments = [
            {
                title: pdfs[0].title,
                type: "pdf",
                id: `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}-${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}-${segmentPathInfo.segment}`,
                resourceId: `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}`,
                index: `${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}/${segmentPathInfo.segment}`,
                name: `${segmentPathInfo.segment}`,
                pdf: pdfs,
            }
        ]

        if (/^\d+$/.test(documentInfo.name)) {
            documentInfo.sequence = `${parseInt(documentInfo.name)}`
        } else {
            documentInfo.sequence = `•`
        }

        if (!returnOnly) {
            for (let pdfSegment of documentInfo.segments) {
                fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}/${pdfSegment.name}/index.json`, JSON.stringify(pdfSegment))
            }
            fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}/index.json`, JSON.stringify(documentInfo))
        } else {
            documents.push(documentInfo)
        }
    }

    if (returnOnly) {
        return documents
    }
}

// TODO: instead of wildcard for the resource glob, process only the ones that are in the git change
//       if more than lets say 20 then use **
let processDocuments = async function (language, resourceType, resourceGlob) {
    const resources = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(3)
        .glob(`${language}/${resourceType}/${resourceGlob}/info.yml`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let resource of resources) {
        console.log(`Processing resource, ${resource}`)
        const batch = database.batch()
        let resourcePathInfo = parseResourcePath(`${SOURCE_DIR}/${resource}`)
        const resourceInfoYaml = yaml.load(fs.readFileSync(`${SOURCE_DIR}/${resource}`, "utf8"));

        const documents = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/*/**/info.yml`)
            .crawl(SOURCE_DIR)
            .sync();

        const pdfFilePath = `${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_PDF_FILENAME}`

        if (!documents.length
            && fs.pathExistsSync(pdfFilePath)) {
            await processPDFOnlyResource(`${SOURCE_DIR}/${resource}`)
        }

        for (let document of documents) {
            let documentInfo = await getDocumentInfoYml(`${SOURCE_DIR}/${document}`, true)
            let documentPathInfo = parseResourcePath(document)
            let append = ""

            if (fs.pathExistsSync(`${SOURCE_DIR}/${document.replace('/info.yml', '')}/teacher-comments.md`)) {
                append = `\n\n---\n\n{#[${documentInfo.index}/teacher-comments.md]}`
            }

            documentInfo.segments = []

            const segments = new fdir()
                .withBasePath()
                .withRelativePaths()
                .withMaxDepth(1)
                .glob(`*${SEGMENT_FILENAME_EXTENSION}`)
                .crawl(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}`)
                .sync();

            for (let segment of segments) {
                let segmentInfo = await getSegmentInfo(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}${segment}`, true, /^teacher-comments\.md/.test(segment) ? "" : append)
                let segmentPathInfo = parseResourcePath(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}${segment}`)

                // skipping hidden segments
                if (!/^_/.test(segment) && !/teacher-comments.md$/.test(segment)) {
                    documentInfo.segments.push(segmentInfo)
                }
                fs.outputFileSync(`${API_DIST}/${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}/${segmentPathInfo.segment}/index.json`, JSON.stringify(segmentInfo))
            }

            let style = deepMerge(SEGMENT_DEFAULT_BLOCK_STYLES, resourceInfoYaml.style)
            documentInfo.style = deepMerge(style, documentInfo.style)

            fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}/index.json`, JSON.stringify(documentInfo))
        }
    }
}

if (isMainModule(import.meta)) {
    Object.keys(arg).map(async (argLanguage) => {
        Object.keys(arg[argLanguage]).map(async (argType) => {
            await processDocuments(argLanguage, argType, arg[argLanguage][argType].resources)
        })
    })
}

export {
    getSegmentInfo,
    getDocumentInfoYml,
    processPDFOnlyResource,
}
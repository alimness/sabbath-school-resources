#!/usr/bin/env node
"use strict"

import crypto from "crypto"
import yaml from "js-yaml"
import fs from "fs-extra"
import frontMatter from "front-matter"
import { fdir } from "fdir"
import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import { parseSegment } from "../helpers/blocks.js"
import { database } from "../helpers/firebase.js"
import {
    SOURCE_DIR,
    API_DIST,
    RESOURCE_TYPE,
    SEGMENT_TYPES,
    FIREBASE_DATABASE_BLOCKS,
    FIREBASE_DATABASE_SEGMENTS, FIREBASE_DATABASE_DOCUMENTS, GLOBAL_ASSETS_DIR, ASSETS_URL, RESOURCE_PDF_FILENAME
} from "../helpers/constants.js"
import { SEGMENT_DEFAULT_BLOCK_STYLES } from "../helpers/styles.js"

let getDocumentInfoFromPDF = async function (pdf) {
    const pdfPathInfo = parseResourcePath(document)
    const documentInfo = {}
    // documentInfo.id = `${pdfPathInfo.language}-${pdfPathInfo.type}-${pdfPathInfo.title}-${DOCUMENT_CONTENT_DIRNAME}-${SECTION_DEFAULT_NAME}-${documentPathInfo.document}`
}

let getDocumentInfoYml = async function (document) {
    const documentInfo = yaml.load(fs.readFileSync(document, "utf8"));
    const documentPathInfo = parseResourcePath(document)

    documentInfo.id = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`
    documentInfo.resourceId = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}`
    documentInfo.resourceIndex = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}`
    documentInfo.index = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}`
    documentInfo.name = `${documentPathInfo.document}`

    if (documentInfo.chips) {
        documentInfo.showSegmentChips = true
        delete documentInfo.chips
    }

    if (!documentInfo.cover && fs.pathExistsSync(`${GLOBAL_ASSETS_DIR}/images/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.document}/cover.png`)) {
        documentInfo.cover = `${ASSETS_URL}/assets/images/${documentPathInfo.type}/${documentPathInfo.title}/${documentPathInfo.document}/cover.png`
    }

    return documentInfo
}

let getSegmentInfo = async function (segment, processBlocks = false) {
    const segmentFile = fs.readFileSync(segment, "utf8");
    const segmentInfoFrontMatter = frontMatter(segmentFile)
    const segmentPathInfo = parseResourcePath(segment)

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

    return segmentInfo
}

// TODO: instead of wildcard for the resource glob, process only the ones that are in the git change
//       if more than lets say 20 then use **
let processDocuments = async function (resourceType) {

    const resources = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(7)
        .glob(`**/${resourceType}/*/info.yml`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let resource of resources) {
        let resourcePathInfo = parseResourcePath(`${SOURCE_DIR}/${resource}`)

        const documents = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`**/${resourceType}/${resourcePathInfo.title}/*/**/info.yml`)
            .crawl(SOURCE_DIR)
            .sync();

        // const pdfFilePath = `${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_PDF_FILENAME}`

        // if (!documents.length
        //     && fs.pathExistsSync(pdfFilePath)) {
        //     const pdfFile = yaml.load(fs.readFileSync(pdfFilePath, "utf8"))
        //
        //     for (let pdf of pdfFile.pdf) {
        //         if (!pdf.title || !pdf.target) { continue }
        //         let resourcePathInfo = parseResourcePath(pdf.target)
        //         console.log(resourcePathInfo)
        //     }
        // }

        for (let document of documents) {
            let documentInfo = await getDocumentInfoYml(`${SOURCE_DIR}/${document}`, true)
            let documentPathInfo = parseResourcePath(document)

            documentInfo.segments = []

            const segments = new fdir()
                .withBasePath()
                .withRelativePaths()
                .glob(`*.md`)
                .crawl(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}`)
                .sync();

            for (let segment of segments) {
                let segmentInfo = await getSegmentInfo(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}${segment}`, true)
                let segmentPathInfo = parseResourcePath(`${SOURCE_DIR}/${document.replace(/info.yml/g, '')}${segment}`)

                let setBlockInDatabase = async function (block) {
                    if (block.items && block.items.length) {
                        for (let itemBlock of block.items) {
                            if (itemBlock && itemBlock.id) {
                                await setBlockInDatabase(itemBlock)
                            }
                        }
                    }
                    if (block && block.id) {
                        await database.collection(FIREBASE_DATABASE_BLOCKS).doc(block.id).set(block);
                    }
                }

                if (segmentInfo.blocks) {
                    for (let block of segmentInfo.blocks) {
                        await setBlockInDatabase(block)
                    }
                }

                await database.collection(FIREBASE_DATABASE_SEGMENTS).doc(segmentInfo.id).set(segmentInfo)
                documentInfo.segments.push(segmentInfo)
                fs.outputFileSync(`${API_DIST}/${segmentPathInfo.language}/${resourceType}/${segmentPathInfo.title}/${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}${segmentPathInfo.document}/${segmentPathInfo.segment}/index.json`, JSON.stringify(segmentInfo))
            }

            await database.collection(FIREBASE_DATABASE_DOCUMENTS).doc(documentInfo.id).set(documentInfo)

            documentInfo.defaultStyles = SEGMENT_DEFAULT_BLOCK_STYLES
            fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${resourceType}/${documentPathInfo.title}/${documentPathInfo.section ? documentPathInfo.section + "-" : ""}${documentPathInfo.document}/index.json`, JSON.stringify(documentInfo))
        }
    }
}

if (isMainModule(import.meta)) {
    await processDocuments(RESOURCE_TYPE.DEVO)
    await processDocuments(RESOURCE_TYPE.PM)
    await processDocuments(RESOURCE_TYPE.AIJ)
}

export {
    getSegmentInfo,
    getDocumentInfoYml
}
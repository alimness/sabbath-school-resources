#!/usr/bin/env node
"use strict"

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
    DOCUMENT_CONTENT_DIRNAME,
    SEGMENT_TYPES,
    SECTION_DEFAULT_NAME,
    FIREBASE_DATABASE_BLOCKS,
    FIREBASE_DATABASE_SEGMENTS, FIREBASE_DATABASE_DOCUMENTS
} from "../helpers/constants.js"
import { SEGMENT_DEFAULT_BLOCK_STYLES } from "../helpers/styles.js"


let getDocumentInfoYml = async function (document) {
    const documentInfo = yaml.load(fs.readFileSync(document, "utf8"));
    const documentPathInfo = parseResourcePath(document)

    documentInfo.id = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${DOCUMENT_CONTENT_DIRNAME}-${documentPathInfo.section || SECTION_DEFAULT_NAME}-${documentPathInfo.document}`
    documentInfo.resourceId = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}`
    documentInfo.resourceIndex = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}`
    documentInfo.index = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${documentPathInfo.section || SECTION_DEFAULT_NAME}/${documentPathInfo.document}`
    documentInfo.name = `${documentPathInfo.document}`

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

    if (processBlocks) {
        segmentInfo.blocks = await parseSegment(segmentInfoFrontMatter.body, segmentPathInfo, "root", 1, segmentFilterForType[segmentInfo.type])
    }

    segmentInfo.id = `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}-${DOCUMENT_CONTENT_DIRNAME}-${segmentPathInfo.section || SECTION_DEFAULT_NAME}-${segmentPathInfo.document}-segments-${segmentPathInfo.segment}`
    segmentInfo.resourceId = `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}`
    segmentInfo.index = `${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${segmentPathInfo.section || SECTION_DEFAULT_NAME}/${segmentPathInfo.document}/segments/${segmentPathInfo.segment}`
    segmentInfo.name = `${segmentPathInfo.segment}`
    segmentInfo.defaultStyles = SEGMENT_DEFAULT_BLOCK_STYLES

    return segmentInfo
}

// TODO: instead of wildcard for the resource glob, process only the ones that are in the git change
//       if more than lets say 20 then use **
let processDocuments = async function (resourceType) {
    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(6)
        .glob(`**/${resourceType}/**/content/**/info.yml`)
        .crawl(SOURCE_DIR)
        .sync();

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

            await database.collection(FIREBASE_DATABASE_SEGMENTS).doc(segmentInfo.id).set(segmentInfo);
            documentInfo.segments.push(segmentInfo)
            fs.outputFileSync(`${API_DIST}/${segmentPathInfo.language}/${resourceType}/${segmentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${segmentPathInfo.section ? `${segmentPathInfo.section}/` : "root/"}${segmentPathInfo.document}/segments/${segmentPathInfo.segment}/index.json`, JSON.stringify(segmentInfo))
        }

        await database.collection(FIREBASE_DATABASE_DOCUMENTS).doc(documentInfo.id).set(documentInfo);
        fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${resourceType}/${documentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${documentPathInfo.section ? `${documentPathInfo.section}/` : "root/"}${documentPathInfo.document}/index.json`, JSON.stringify(documentInfo))
    }
}

if (isMainModule(import.meta)) {
    await processDocuments(RESOURCE_TYPE.DEVO)
    // await processDocuments(RESOURCE_TYPE.PM)
    // await processDocuments(RESOURCE_TYPE.AIJ)
}

export {
    getSegmentInfo,
    getDocumentInfoYml
}
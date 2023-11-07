#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import frontMatter from "front-matter"
import { fdir } from "fdir"
import { isMainModule, parseResourcePath } from '../helpers/helpers.js'
import { parseDocument } from '../helpers/blocks.js'

import {
    SOURCE_DIR,
    API_DIST,
    RESOURCE_TYPE, DOCUMENT_CONTENT_DIRNAME, DOCUMENT_TYPES, CATEGORY_DEFAULT_NAME
} from "../helpers/constants.js"

let getDocumentInfo = async function (document, processBlocks = false) {
    const documentFile = fs.readFileSync(document, 'utf8');
    const documentInfoFrontMatter = frontMatter(documentFile)
    const documentPathInfo = parseResourcePath(document)

    const documentInfo = {
        ...documentInfoFrontMatter.attributes,
    }

    if (!documentInfo.type) {
        if (processBlocks) {
            documentInfo.blocks = parseDocument(documentInfoFrontMatter.body, documentPathInfo, 'root')
        }
        documentInfo.type = DOCUMENT_TYPES.BLOCK
    }

    documentInfo.id = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${DOCUMENT_CONTENT_DIRNAME}-${documentPathInfo.section || CATEGORY_DEFAULT_NAME}-${documentPathInfo.document}`
    documentInfo.index = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${documentPathInfo.section || CATEGORY_DEFAULT_NAME}/${documentPathInfo.document}`

    return documentInfo
}

// TODO: instead of wildcard for the resource glob, process only the ones that are in the git change
//       if more than lets say 20 then use **
let processDocuments = async function (resourceType) {
    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(5)
        .glob(`**/${resourceType}/**/*.md`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let document of documents) {
        let documentInfo = await getDocumentInfo(`${SOURCE_DIR}/${document}`, true)
        let documentPathInfo = parseResourcePath(document)
        fs.outputFileSync(`${API_DIST}/${documentPathInfo.language}/${resourceType}/${documentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${documentPathInfo.section ? `${documentPathInfo.section}/` : 'root/'}${documentPathInfo.document}/index.json`, JSON.stringify(documentInfo))
    }
}

if (isMainModule(import.meta)) {
    await processDocuments(RESOURCE_TYPE.DEVO)
    await processDocuments(RESOURCE_TYPE.PM)
}

export {
    getDocumentInfo
}
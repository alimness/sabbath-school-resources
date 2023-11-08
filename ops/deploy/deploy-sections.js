#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import yaml from "js-yaml"
import { fdir } from "fdir"
import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import { getResourceInfo } from "./deploy-resources.js"
import { getDocumentInfo } from "./deploy-documents.js"
import {
    SOURCE_DIR,
    API_DIST,
    RESOURCE_TYPE,
    RESOURCE_CONTENT_DIRNAME,
    RESOURCE_INFO_FILENAME,
    SECTION_INFO_FILENAME, RESOURCE_ORDER, CATEGORY_DEFAULT_NAME
} from "../helpers/constants.js"

let getSectionInfo = async function (section) {
    return yaml.load(fs.readFileSync(section, "utf8"))
}

let processSections = async function (resourceType) {
    const resources = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(3)
        .glob(`**/${resourceType}/**/${RESOURCE_INFO_FILENAME}`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let resource of resources) {
        const resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${resource}`)
        const resourcePathInfo = parseResourcePath(`${SOURCE_DIR}/${resource}`)
        const resourceContentPath = `${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_CONTENT_DIRNAME}`

        const sections = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(1)
            .glob("**/info.yml")
            .crawl(resourceContentPath)
            .sync()

        const resourceSectionData = {
            CATEGORY_DEFAULT_NAME: {
                id: `${resourcePathInfo.language}-${resourcePathInfo.type}-${resourcePathInfo.title}-${CATEGORY_DEFAULT_NAME}`,
                title: "",
                isRoot: true,
                documents: []
            }
        }

        for (let section of sections) {
            let sectionInfo = await getSectionInfo(`${resourceContentPath}/${section}`)
            resourceSectionData[`${section.replace(`/${SECTION_INFO_FILENAME}`, "")}`] = {
                id: `${resourcePathInfo.language}-${resourcePathInfo.type}-${resourcePathInfo.title}-${section.replace(`/${SECTION_INFO_FILENAME}`, "")}`,
                documents: [],
                ...sectionInfo
            }
        }

        let documents = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(1)
            .glob("**/*.md")
            .crawl(resourceContentPath)
            .sync()

        if (resourceInfo.order && resourceInfo.order === RESOURCE_ORDER.DESC) {
            documents = documents.reverse()
        }

        for (let document of documents) {
            const documentSectionName = document.substring(0, document.lastIndexOf("/")) || CATEGORY_DEFAULT_NAME
            const documentInfo = await getDocumentInfo(`${resourceContentPath}/${document}`)
            resourceSectionData[documentSectionName].documents.push(documentInfo)
        }

        resourceInfo.sections = Object.values(resourceSectionData)
        fs.outputFileSync(`${API_DIST}/${resourcePathInfo.language}/${resourceType}/${resourcePathInfo.title}/sections/index.json`, JSON.stringify(resourceInfo))
    }
}

if (isMainModule(import.meta)) {
    await processSections(RESOURCE_TYPE.DEVO)
    await processSections(RESOURCE_TYPE.PM)
}

export {
    getSectionInfo
}
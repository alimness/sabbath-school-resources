#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import { fdir } from "fdir"
import { getResourceInfo } from "../deploy/deploy-resources.js"
import { getSectionInfo } from "../deploy/deploy-sections.js"
import { validate } from "jsonschema"

import {
    SOURCE_DIR,
    RESOURCE_TYPE,
    RESOURCE_KIND,
    RESOURCE_INFO_FILENAME,
    RESOURCE_CONTENT_DIRNAME,
    SECTION_INFO_FILENAME,
    RESOURCE_ASSETS_DIRNAME, RESOURCE_COVERS
} from "../helpers/constants.js"

let failMessages = []

let fail = function (message) {
    failMessages.push(message);
}

const resourceSchema = {
    "$id": "/schemas/resource",
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "id": { type: "string", },
        "index": { type: "string", },
        "title": { type: "string", },
        "subtitle": { type: "string", },
        "description": { type: "string", },
        "kind": {
            type: "string",
            enum: [
                RESOURCE_KIND.BOOK,
                RESOURCE_KIND.DEVOTIONAL,
                RESOURCE_KIND.PLAN,
                RESOURCE_KIND.EXTERNAL,
                RESOURCE_KIND.BLOG,
            ]
        },
        "credits": { type: "array", },
        "features": { type: "array", },
        "primaryColor": { type: "string", },
        "primaryColorDark": { type: "string", },
        "startDate": { type: "string", },
        "endDate": { type: "string", },
        "author": { type: "string", },
        "categories": { type: "array", },
        "referenceResource": { "$ref": "/schemas/resource" },
        "covers": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "portrait": { type: "string" },
                "landscape": { type: "string" },
                "square": { type: "string" },
                "splash": { type: "string" },
            }
        },
        "documentId": { type: String },
        "externalURL": { type: String },
    },
    "required": [ "id", "index", "kind", "title", "primaryColor", "primaryColorDark" ]
}
const sectionSchema = {
    "$id": "/schemas/section",
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "title": { type: "string", },
    },
    "required": [ "title" ]
}

// TODO: add feed validation for categories, authors and resource roots
let validateResources = async function (resourceType) {
    const resources = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(3)
        .glob(`**/${resourceType}/**/${RESOURCE_INFO_FILENAME}`)
        .crawl(SOURCE_DIR)
        .sync();
    for (let resource of resources) {
        let resourceInfo
        let resourcePathInfo

        try {
            resourcePathInfo = parseResourcePath(resource)
        } catch (e) {
            e = e.toString().replace(/\n/g, '<br>');
            fail(`Critical error. Can not parse the resource path: ${resource}. Error: \`${e}\``);
            continue
        }

        try {
            resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${resource}`)
        } catch (e) {
            e = e.toString().replace(/\n/g, '<br>');
            fail(`Critical error. Can not parse the resource info: ${resource}. Error: \`${e}\``);
            continue
        }

        try {
            const resourceContentPath = `${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_CONTENT_DIRNAME}`
            const sections = new fdir()
                .withBasePath()
                .withRelativePaths()
                .withMaxDepth(1)
                .onlyDirs()
                .filter(d => d !== `${resourceContentPath}/`)
                .crawl(resourceContentPath)
                .sync();

            for (let section of sections) {
                const sectionInfo = await getSectionInfo(`${section}/${SECTION_INFO_FILENAME}`)

                let validateResult = validate(sectionInfo, sectionSchema)
                if (validateResult.errors.length) {
                    let errors = ""
                    validateResult.errors.map(e => {
                        errors += `${e.stack} <br/>`
                    })
                    fail(`Critical error. Found section ${section} on ${resource} but validation failed - ${errors}`);
                }
            }
        } catch (e) {
            e = e.toString().replace(/\n/g, '<br>');
            fail(`Critical error. Error checking sections of ${resource}. Error: \`${e}\``);
            continue
        }

        try {
            const documents = new fdir()
                .withBasePath()
                .withRelativePaths()
                .withMaxDepth(2)
                .glob(`**/*.md`)
                .crawl(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}`)
                .sync();

            if (resourceInfo.kind !== RESOURCE_KIND.EXTERNAL) {
                if (!documents.length) {
                    fail(`Critical error. Did not find any documents in ${resource}.`);
                    continue
                }
            }
        } catch (e) {
            e = e.toString().replace(/\n/g, '<br>');
            fail(`Critical error. Can not determine documents for ${resource}. Error: \`${e}\``);
            continue
        }

        if (resourceInfo.kind === RESOURCE_KIND.EXTERNAL
            && !resourceInfo.externalURL) {
            fail(`Critical error. External resource found without the external URL value: ${resource}`);
            continue
        }

        try {
            let validateResult = validate(resourceInfo, resourceSchema)
            if (validateResult.errors.length) {
                let errors = ""
                validateResult.errors.map(e => {
                    errors += `${e.stack} <br/>`
                })
                fail(`Critical error. Resource validation error: on ${resource} - ${errors}`);
                continue
            }
        } catch (e) {
            fail(`Critical error. Resource validation error: ${resource}, ${e}`);
            continue
        }

        try {
            if (!resourceInfo && !resourceInfo['portrait'] && !fs.pathExistsSync(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${RESOURCE_COVERS.PORTRAIT}`)) {
                fail(`Portrait cover not found for resource: ${resource}`);
            }

            if (!resourceInfo && !resourceInfo['landscape'] && !fs.pathExistsSync(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${RESOURCE_COVERS.LANDSCAPE}`)) {
                fail(`Landscape cover not found for resource: ${resource}`);
            }

            if (!resourceInfo && !resourceInfo['square'] && !fs.pathExistsSync(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${RESOURCE_COVERS.SQUARE}`)) {
                fail(`Square cover not found for resource: ${resource}`);
            }

            if (!resourceInfo && !resourceInfo['splash'] && !fs.pathExistsSync(`${SOURCE_DIR}/${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${RESOURCE_COVERS.SPLASH}`)) {
                fail(`Splash cover not found for resource: ${resource}`);
            }
        } catch (e) {
            fail(`Critical error. Checking covers validation error: ${resource}, ${e}`);
        }
    }
}

if (isMainModule(import.meta)) {
    await validateResources(RESOURCE_TYPE.DEVO)
    await validateResources(RESOURCE_TYPE.PM)

    if (failMessages.length) {
        let pullRequestComment = "Ooops! Issues were found\n"
        pullRequestComment += "||Error description |\n| ----------- | ----------- |"

        for (let message of failMessages) {
            pullRequestComment += `\n|🛑| ${message}|`
        }
        console.error(pullRequestComment)
    }
}
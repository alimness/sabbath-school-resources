#!/usr/bin/env node
"use strict"

import yaml from "js-yaml"
import fs from "fs-extra"
import { fdir } from "fdir"
import { database } from "../helpers/firebase.js"
import { getDocumentInfo } from "./deploy-documents.js"
import { getLanguageInfo } from "./deploy-languages.js"
import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import { getLanguages } from "./deploy-languages.js"
import {
    SOURCE_DIR,
    API_DIST,
    RESOURCE_TYPE,
    RESOURCE_COLOR_PRIMARY,
    RESOURCE_COLOR_PRIMARY_DARK,
    RESOURCE_KIND,
    RESOURCE_INFO_FILENAME,
    RESOURCE_FEED_FILENAME,
    RESOURCE_CONTENT_DIRNAME,
    FEED_SCOPES,
    FEED_VIEWS,
    FEED_DIRECTION,
    FIREBASE_DATABASE_RESOURCES, FIREBASE_DATABASE_LANGUAGES
} from "../helpers/constants.js"


let getResourceInfo = async function (resource, depth = 0) {
    const resourceInfo = yaml.load(fs.readFileSync(resource, "utf8"));
    const resourcePathInfo = parseResourcePath(resource)
    const languageInfo = await getLanguageInfo(resourcePathInfo.language)

    resourceInfo.id = `${resourcePathInfo.language}-${resourcePathInfo.type}-${resourcePathInfo.title}`
    resourceInfo.index = `${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}`
    resourceInfo.name = `${resourcePathInfo.title}`
    resourceInfo.type = `${resourcePathInfo.type}`

    // Setting up defaults if not present in the info.yml
    resourceInfo.credits = resourceInfo.credits ?? []
    resourceInfo.features = resourceInfo.features ?? []
    resourceInfo.kind = resourceInfo.kind ?? RESOURCE_KIND.BOOK
    resourceInfo.primaryColor = resourceInfo.primaryColor ?? RESOURCE_COLOR_PRIMARY
    resourceInfo.primaryColorDark = resourceInfo.primaryColorDark ?? RESOURCE_COLOR_PRIMARY_DARK

    if (!resourceInfo.subtitle || resourceInfo.subtitle.indexOf(languageInfo.kinds[resourceInfo.kind]) < 0) {
        resourceInfo.subtitle = [languageInfo.kinds[resourceInfo.kind], resourceInfo.subtitle || undefined, ].filter(e => e !== undefined).join(" · ")
    }

    if (!depth && resourceInfo.referenceResource && typeof resourceInfo.referenceResource !== "string") {
        const referenceResourcePath = `${SOURCE_DIR}/${resourceInfo.referenceResource}/${RESOURCE_INFO_FILENAME}`
        if (fs.pathExistsSync(referenceResourcePath)) {
            resourceInfo.referenceResource = await getResourceInfo(referenceResourcePath, depth++)
        }
    }

    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(5)
        .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_CONTENT_DIRNAME}/**/*.md`)
        .crawl(`${SOURCE_DIR}/`)
        .sync();

    if (documents.length === 1) {
        let document = documents[0]
        let documentInfo = await getDocumentInfo(`${SOURCE_DIR}/${document}`)
        resourceInfo.documentId = documentInfo.id
        resourceInfo.documentIndex = documentInfo.index
    }

    if (resourceInfo.externalURL) {
        resourceInfo.kind = RESOURCE_KIND.EXTERNAL
    }

    return resourceInfo
}

let getResourceFeed = async function (resource) {
    let resourceFeed = yaml.load(fs.readFileSync(resource, "utf8"))
    return resourceFeed
}

let processResources = async function (resourceType) {
    const languages = await getLanguages()

    for (let language of languages) {
        const resources = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(3)
            .glob(`${language}/${resourceType}/**/${RESOURCE_INFO_FILENAME}`)
            .crawl(SOURCE_DIR)
            .sync();

        const resourceFeedConfig = await getResourceFeed(`${SOURCE_DIR}/${language}/${resourceType}/${RESOURCE_FEED_FILENAME}`)
        let resourceFeed = []

        resourceFeedConfig.map(g => {
            resourceFeed.push({
                ...g,
                title: g.group,
                author: g.author || null,
                scope: g.scope || null,
                resources: [],
                resourceIds: g.resources || [],
                view: g.view || FEED_VIEWS.TILE,
                recent: g.recent || null,
                direction: g.direction || FEED_DIRECTION.HORIZONTAL,
            })
        })

        for (let resource of resources) {
            try {
                const resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${resource}`)
                const resourcePathInfo = parseResourcePath(resource)

                let groupByName = resourceFeed.find(g => g.resourceIds.includes(resourceInfo.id))
                let groupByAuthor = resourceFeed.find(g => g.author === resourceInfo.author)
                let groupByKind = resourceFeed.find(g => g.kind === resourceInfo.kind)
                let groupByType = resourceFeed.find(g => g.scope === FEED_SCOPES.RESOURCE)

                if (groupByName) {
                    groupByName.resources.push(resourceInfo)
                } else if (groupByAuthor) {
                    groupByAuthor.resources.push(resourceInfo)
                } else if (groupByKind) {
                    groupByKind.resources.push(resourceInfo)
                } else if (groupByType) {
                    groupByType.resources.push(resourceInfo)
                }

                await database.collection(FIREBASE_DATABASE_RESOURCES).doc(resourceInfo.id).set(resourceInfo);

                fs.outputFileSync(`${API_DIST}/${resourcePathInfo.language}/${resourceType}/${resourcePathInfo.title}/index.json`, JSON.stringify(resourceInfo))
            } catch (e) {
                console.error(`Error processing resources: ${e}`);
            }
        }

        const recentFeedGroup = resourceFeed.find(g => g.recent)

        if (recentFeedGroup && recentFeedGroup.group) {
            const recentFeedGroupAPI = {
                title: recentFeedGroup.group,
                view: recentFeedGroup.view || FEED_VIEWS.SQUARE,
                scope: recentFeedGroup.scope || FEED_SCOPES.RESOURCE,
                resources: [],
                direction: recentFeedGroup.direction || FEED_DIRECTION.HORIZONTAL,
            }
            await database.collection(FIREBASE_DATABASE_LANGUAGES).doc(language).collection(resourceType).doc("recentFeedGroup").set(recentFeedGroupAPI);
        }

        resourceFeed = resourceFeed.filter(g => g.resources.length).map(g => {
            delete g.kind
            delete g.resourceIds
            delete g.documentIds
            delete g.author
            delete g.group
            if (!g.scope && g.resources.length) {
                g.scope = FEED_SCOPES.RESOURCE
            }
            delete g.recent
            return g
        })

        // TODO: limit per composite feed
        // iterate over resource feed
        // if item resources more than X
        // Save as separate endpoint all feed group data
        // truncate the resourceFeed to X
        // generate resource group ID
        // repeat for categories & authors

        fs.outputFileSync(`${API_DIST}/${language}/${resourceType}/index.json`, JSON.stringify(resourceFeed))
    }
}

if (isMainModule(import.meta)) {
    await processResources(RESOURCE_TYPE.DEVO)
    await processResources(RESOURCE_TYPE.PM)
}

export {
    getResourceInfo
}
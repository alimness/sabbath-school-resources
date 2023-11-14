#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import yaml from "js-yaml"
import { fdir } from "fdir"
import { getResourceInfo } from "./deploy-resources.js"
import { getDocumentInfo } from "./deploy-documents.js"
import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import {
    API_DIST,
    SOURCE_DIR,
    CATEGORIES_DIRNAME,
    CATEGORY_INFO_FILENAME,
    RESOURCE_INFO_FILENAME,
    RESOURCE_TYPE,
    CATEGORY_FEED_FILENAME,
    FEED_VIEWS,
    FEED_SCOPES, FEED_DIRECTION,
} from "../helpers/constants.js"

let getCategoryInfo = async function (category) {
    const categoryInfo = yaml.load(fs.readFileSync(category, "utf8"))
    return categoryInfo
}

let getCategoryFeed = async function (category) {
    let categoryFeed = yaml.load(fs.readFileSync(category, "utf8"))
    return categoryFeed
}

// TODO: block tagging
let getAllTaggedResources = async function () {
    const resources = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(3)
        .glob(`**/+(${RESOURCE_TYPE.DEVO}|${RESOURCE_TYPE.PM})/**/${RESOURCE_INFO_FILENAME}`)
        .crawl(SOURCE_DIR)
        .sync();

    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(5)
        .glob(`**/+(${RESOURCE_TYPE.DEVO}|${RESOURCE_TYPE.PM})/**/*.md`)
        .crawl(SOURCE_DIR)
        .sync();

    let allTaggedResources = {
        resources: [],
        documents: [],
    }

    for (let resource of resources) {
        try {
            let resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${resource}`)
            if (resourceInfo.categories) {
                allTaggedResources.resources.push(resourceInfo)
            }
        } catch (e) {
            console.error(`Error processing tagged resource: ${e}`);
        }
    }

    for (let document of documents) {
        try {
            let documentInfo = await getDocumentInfo(`${SOURCE_DIR}/${document}`)
            if (documentInfo.categories) {
                allTaggedResources.documents.push(documentInfo)
            }
        } catch (e) {
            console.error(`Error processing tagged document: ${e}`);
        }
    }

    return allTaggedResources
}

let processCategories = async function () {
    const categories = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(4)
        .glob(`**/${CATEGORIES_DIRNAME}/**/${CATEGORY_INFO_FILENAME}`)
        .crawl(SOURCE_DIR)
        .sync();

    const allTaggedResources = await getAllTaggedResources()
    const allCategories = {}

    for (let category of categories) {
        try {
            const categoryInfo = await getCategoryInfo(`${SOURCE_DIR}/${category}`)
            const categoryInfoDetail = { ...categoryInfo }
            const categoryPathInfo = parseResourcePath(`${SOURCE_DIR}/${category}`)
            const categoryFeed = await getCategoryFeed(`${SOURCE_DIR}/${categoryPathInfo.language}/${CATEGORIES_DIRNAME}/${categoryPathInfo.title}/${CATEGORY_FEED_FILENAME}`)

            categoryInfoDetail.feed = []

            const categoryResources = allTaggedResources.resources.filter(r => r.categories.indexOf(categoryPathInfo.title) >= 0)
            const categoryDocuments = allTaggedResources.documents.filter(d => d.categories.indexOf(categoryPathInfo.title) >= 0)

            categoryFeed.map(g => {
                categoryInfoDetail.feed.push({
                    ...g,
                    title: g.group,
                    resources: [],
                    documents: [],
                    author: g.author || null,
                    resourceIds: g.resources || [],
                    documentIds: [],
                    scope: g.scope || null,
                    view: g.view || FEED_VIEWS.TILE,
                    direction: g.direction || FEED_DIRECTION.HORIZONTAL,
                })
            })

            for (let categoryResource of categoryResources) {
                let groupByName = categoryInfoDetail.feed.find(g => g.resourceIds.indexOf(categoryResource.id) >= 0)
                if (groupByName) {
                    groupByName.resources.push(categoryResource)
                    continue
                }

                let groupByAuthor = categoryInfoDetail.feed.find(g => g.author === categoryResource.author)
                if (groupByAuthor) {
                    groupByAuthor.resources.push(categoryResource)
                    continue
                }

                let groupByKind = categoryInfoDetail.feed.find(g => g.kind === categoryResource.kind)
                if (groupByKind) {
                    groupByKind.resources.push(categoryResource)
                    continue
                }

                let groupByScope = categoryInfoDetail.feed.find(g => g.scope === FEED_SCOPES.RESOURCE)
                if (groupByScope) {
                    groupByScope.resources.push(categoryResource)
                }
            }

            for (let categoryDocument of categoryDocuments) {
                let groupByScope = categoryInfoDetail.feed.find(g => g.scope === FEED_SCOPES.DOCUMENT)
                if (groupByScope) {
                    groupByScope.documents.push(categoryDocument)
                }
            }

            categoryInfoDetail.feed = categoryInfoDetail.feed.filter(g => {
                // filter feed groups that do not have any resources or docs
                return g.resources.length || g.documents.length
            }).map(g => {
                // remove unnecessary params
                delete g.kind
                delete g.resourceIds
                delete g.documentIds
                delete g.author
                delete g.group
                if (!g.scope && g.resources.length) {
                    g.scope = FEED_SCOPES.RESOURCE
                }

                // If scope is document, force "square" view
                if ((!g.scope && g.document.length) || (g.scope === FEED_SCOPES.DOCUMENT)-0) {
                    g.scope = FEED_SCOPES.DOCUMENT
                    g.view = FEED_VIEWS.SQUARE
                }
                return g
            })

            if (!allCategories[categoryPathInfo.language]) {
                allCategories[categoryPathInfo.language] = [categoryInfo]
            } else {
                allCategories[categoryPathInfo.language].push(categoryInfo)
            }

            fs.outputFileSync(`${API_DIST}/${categoryPathInfo.language}/${categoryPathInfo.type}/${categoryPathInfo.title}/index.json`, JSON.stringify(categoryInfoDetail))
        } catch (e) {
            console.error(`Error processing categories: ${e}`);
        }
    }

    for (let language of Object.keys(allCategories)) {
        fs.outputFileSync(`${API_DIST}/${language}/${CATEGORIES_DIRNAME}/index.json`, JSON.stringify(allCategories[language]))
    }
}

if (isMainModule(import.meta)) {
    await processCategories()
}

export {
    getCategoryInfo
}
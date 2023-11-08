#!/usr/bin/env node
"use strict"

import { isMainModule, parseResourcePath } from "../helpers/helpers.js"
import { fdir } from "fdir"
import yaml from "js-yaml"
import fs from "fs-extra"
import {
    API_DIST,
    SOURCE_DIR,
    CATEGORIES_DIRNAME,
    CATEGORY_INFO_FILENAME, RESOURCE_INFO_FILENAME,
    RESOURCE_TYPE, CATEGORY_FEED_FILENAME, CATEGORY_FEED_RESOURCE_TYPE, CATEGORY_FEED_DOCUMENT_TYPE
} from "../helpers/constants.js"
import { getResourceInfo } from "./deploy-resources.js"
import { getDocumentInfo } from "./deploy-documents.js"

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
            console.error(e);
        }
    }

    for (let document of documents) {
        try {
            let documentInfo = await getDocumentInfo(`${SOURCE_DIR}/${document}`)
            if (documentInfo.categories) {
                allTaggedResources.documents.push(documentInfo)
            }
        } catch (e) {
            console.error(e);
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
                    type: g.type || null
                })
            })


            // console.log(allTaggedResources)

            for (let categoryResource of categoryResources) {
                // name
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

                let groupByType = categoryInfoDetail.feed.find(g => g.type === CATEGORY_FEED_RESOURCE_TYPE)
                if (groupByType) {
                    groupByType.resources.push(categoryResource)
                }
            }

            for (let categoryDocument of categoryDocuments) {
                let groupByType = categoryInfoDetail.feed.find(g => g.type === CATEGORY_FEED_DOCUMENT_TYPE)
                if (groupByType) {
                    groupByType.documents.push(categoryDocument)
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
                if (!g.type && g.resources.length) {
                    g.type = CATEGORY_FEED_RESOURCE_TYPE
                }
                if (!g.type && g.document.length) {
                    g.type = CATEGORY_FEED_DOCUMENT_TYPE
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
            console.error(e);
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
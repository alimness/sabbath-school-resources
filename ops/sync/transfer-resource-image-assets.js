#!/usr/bin/env node
"use strict"
import process from 'node:process'
import fs from "fs-extra"
import yaml from "js-yaml"
import { fdir } from "fdir"
import { parseResourcePath, getResourceTypesGlob, getPositiveCoverImagesGlob } from "../helpers/helpers.js"
import { getCategoryInfo } from "../deploy/deploy-categories.js"
import { getResourceInfo } from "../deploy/deploy-resources.js"
import {
    API_URL,
    API_PREFIX,
    SOURCE_DIR,
    RESOURCE_COVERS,

    CATEGORIES_DIRNAME,
    CATEGORY_INFO_FILENAME,
    CATEGORY_ASSETS_DIRNAME,

    AUTHORS_DIRNAME,
    AUTHORS_INFO_FILENAME,
    AUTHORS_ASSETS_DIRNAME,

    RESOURCE_INFO_FILENAME,
    RESOURCE_ASSETS_DIRNAME,
} from "../helpers/constants.js"


let mode = "local"

// AWS command to run prior
// aws s3 cp ./src s3://sabbath-school.adventech.io/api/v2/ --acl "public-read" --region us-east-1 --no-progress --recursive --dryrun --exclude "*" --include "**/assets/cover.png" --include "**/assets/cover-landscape.png" --include "**/assets/cover-square.png" --include "**/assets/splash.png"

if (process && process.env && process.env.GITHUB_TOKEN) {
    mode = "remote"
}

let getCoverKey = function (cover) {
    return Object.keys(RESOURCE_COVERS).find(k => RESOURCE_COVERS[k] === cover).toLowerCase()
}

let transferCategoriesAssets = async function () {
    const categoriesImageAssets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(4)
        .glob(`**/${CATEGORIES_DIRNAME}/**/assets/${getPositiveCoverImagesGlob()}`)
        .crawl(SOURCE_DIR)
        .sync();

    const categories = categoriesImageAssets.reduce((category, assetPath) => {
        const categoryPath = parseResourcePath(assetPath)
        const categoryKey = `${categoryPath.language}/${CATEGORIES_DIRNAME}/${categoryPath.title}`
        category[categoryKey] = category[categoryKey] || []
        category[categoryKey].push(assetPath)
        return category
    }, {})


    for (let category of Object.keys(categories)) {
        const categoryPath = parseResourcePath(category)
        const categoryInfoFile = `${SOURCE_DIR}/${categoryPath.language}/${CATEGORIES_DIRNAME}/${categoryPath.title}/${CATEGORY_INFO_FILENAME}`
        const categoryInfo = await getCategoryInfo(categoryInfoFile)

        if (!categoryInfo.covers) {
            categoryInfo.covers = {}
        }

        for (let categoryImageAsset of categories[category]) {
            const imageAssetPath = parseResourcePath(categoryImageAsset)

            Object.keys(RESOURCE_COVERS).map(k => {
                if (imageAssetPath.section === RESOURCE_COVERS[k]) {
                    categoryInfo.covers[getCoverKey(RESOURCE_COVERS[k])] = `${API_URL()}${API_PREFIX}${categoryPath.language}/${CATEGORIES_DIRNAME}/${categoryPath.title}/${CATEGORY_ASSETS_DIRNAME}/${imageAssetPath.section}`
                    if (mode === "remote") fs.removeSync(`${SOURCE_DIR}/${categoryImageAsset}`)
                }
            })
        }
        if (mode === "remote") fs.outputFileSync(categoryInfoFile, yaml.dump(categoryInfo))
    }
}

let transferAuthorsAssets = async function () {
    const authorsImageAssets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(4)
        .glob(`**/${AUTHORS_DIRNAME}/**/assets/${getPositiveCoverImagesGlob()}`)
        .crawl(SOURCE_DIR)
        .sync();

    const authors = authorsImageAssets.reduce((author, assetPath) => {
        const authorPath = parseResourcePath(assetPath)
        const authorKey = `${authorPath.language}/${AUTHORS_DIRNAME}/${authorPath.title}`
        author[authorKey] = author[authorKey] || []
        author[authorKey].push(assetPath)
        return author
    }, {})


    for (let author of Object.keys(authors)) {
        const authorPath = parseResourcePath(author)
        const authorInfoFile = `${SOURCE_DIR}/${authorPath.language}/${AUTHORS_DIRNAME}/${authorPath.title}/${AUTHORS_INFO_FILENAME}`
        const authorInfo = await getCategoryInfo(authorInfoFile)

        if (!authorInfo.covers) {
            authorInfo.covers = {}
        }

        for (let authorImageAsset of authors[author]) {
            const imageAssetPath = parseResourcePath(authorImageAsset)

            Object.keys(RESOURCE_COVERS).map(k => {
                if (imageAssetPath.section === RESOURCE_COVERS[k]) {
                    authorInfo.covers[getCoverKey(RESOURCE_COVERS[k])] = `${API_URL()}${API_PREFIX}${authorPath.language}/${AUTHORS_DIRNAME}/${authorPath.title}/${AUTHORS_ASSETS_DIRNAME}/${imageAssetPath.section}`
                    if (mode === "remote") fs.removeSync(`${SOURCE_DIR}/${authorImageAsset}`)
                }
            })
        }

        if (mode === "remote") fs.outputFileSync(authorInfoFile, yaml.dump(authorInfo))
    }
}

let transferResourcesAssets = async function () {
    const resourceImageAssets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(4)
        .glob(`**/${getResourceTypesGlob()}/**/assets/${getPositiveCoverImagesGlob()}`)
        .crawl(SOURCE_DIR)
        .sync();

    const resources = resourceImageAssets.reduce((resource, assetPath) => {
        const resourcePath = parseResourcePath(assetPath)
        const resourceKey = `${resourcePath.language}/${resourcePath.type}/${resourcePath.title}`
        resource[resourceKey] = resource[resourceKey] || []
        resource[resourceKey].push(assetPath)
        return resource
    }, {})


    for (let resource of Object.keys(resources)) {
        const resourcePath = parseResourcePath(resource)
        const resourceInfoFile = `${SOURCE_DIR}/${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${RESOURCE_INFO_FILENAME}`
        const resourceInfo = await getResourceInfo(resourceInfoFile)

        if (!resourceInfo.covers) {
            resourceInfo.covers = {}
        }

        for (let resourceImageAsset of resources[resource]) {
            const imageAssetPath = parseResourcePath(resourceImageAsset)

            Object.keys(RESOURCE_COVERS).map(k => {
                if (imageAssetPath.section === RESOURCE_COVERS[k]) {
                    resourceInfo.covers[getCoverKey(RESOURCE_COVERS[k])] = `${API_URL()}${API_PREFIX}${resourcePath.language}/${resourcePath.type}/${resourcePath.title}/${RESOURCE_ASSETS_DIRNAME}/${imageAssetPath.section}`
                    if (mode === "remote") fs.removeSync(`${SOURCE_DIR}/${resourceImageAsset}`)
                }
            })
        }
        if (mode === "remote") fs.outputFileSync(resourceInfoFile, yaml.dump(resourceInfo))
    }
}

let transferResourceImageAssets = async function () {
    await transferCategoriesAssets()
    await transferAuthorsAssets()
    await transferResourcesAssets()
}

await transferResourceImageAssets()
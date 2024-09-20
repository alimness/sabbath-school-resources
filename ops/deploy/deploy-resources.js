#!/usr/bin/env node
"use strict"

import crypto from "crypto"
import yaml from "js-yaml"
import fs from "fs-extra"
import picomatch from "picomatch"
import { fdir } from "fdir"
import { database } from "../helpers/firebase.js"
import { getDocumentInfoYml } from "./deploy-documents.js"
import { getLanguageInfo } from "./deploy-languages.js"
import { isMainModule, parseResourcePath, slug } from "../helpers/helpers.js"
import { getLanguages } from "./deploy-languages.js"
import {
    SOURCE_DIR,
    API_DIST,
    GLOBAL_ASSETS_DIR,
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
    FIREBASE_DATABASE_RESOURCES, FIREBASE_DATABASE_LANGUAGES, API_URL, API_PREFIX, ASSETS_URL, DOCUMENT_INFO_FILENAME,
    DEPLOY_ENV
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

    // if (!resourceInfo.subtitle || resourceInfo.subtitle.indexOf(languageInfo.kinds[resourceInfo.kind]) < 0) {
    //     resourceInfo.subtitle = [languageInfo.kinds[resourceInfo.kind], resourceInfo.subtitle || undefined, ].filter(e => e !== undefined).join(" · ")
    // }

    if (depth && resourceInfo.featuredResources) {
        let featuredResources = await Promise.all(resourceInfo.featuredResources.map(async featuredResource => {
            const featuredResourcePath = `${SOURCE_DIR}/${featuredResource}/${RESOURCE_INFO_FILENAME}`
            if (fs.pathExistsSync(featuredResourcePath)) {
                return await getResourceInfo(featuredResourcePath)
            }
        }))
        resourceInfo.feeds = [{
            name: "featured",
            id: crypto.createHash("sha256").update(
                `${resource}-featured`
            ).digest("hex"),
            direction: featuredResources.length > 1 ? FEED_DIRECTION.HORIZONTAL : FEED_DIRECTION.VERTICAL,
            scope: FEED_SCOPES.RESOURCE,
            view: FEED_VIEWS.TILE,
            title: languageInfo.featuredResources.title,
            resources: featuredResources
        }]
    }

    delete resourceInfo.featuredResources

    // TODO: make seamless for local testing
    // TODO: if local then local covers
    // TODO: if remote
        //  if !cover set the remote default cover
        //  if !landscape cover landscape = cover
        //  if !square cover square = cover
        //  if !splash cover splash = cover
    if (DEPLOY_ENV === "local" && !resourceInfo.covers) {
        resourceInfo.covers = {
            landscape: `http://localhost:3002/api/v2/en/${resourceInfo.type}/${resourceInfo.name}/assets/cover-landscape.png`,
            square: `http://localhost:3002/api/v2/en/${resourceInfo.type}/${resourceInfo.name}/assets/cover-square.png`,
            portrait: `http://localhost:3002/api/v2/en/${resourceInfo.type}/${resourceInfo.name}/assets/cover.png`,
            splash: `http://localhost:3002/api/v2/en/${resourceInfo.type}/${resourceInfo.name}/assets/splash.png`,
        }
    }

    // "Backporting" square, splash and landscape if don't have it
    if (resourceInfo.covers) {
        resourceInfo.covers.square ??= resourceInfo.covers.portrait
        resourceInfo.covers.splash ??= resourceInfo.covers.portrait
        resourceInfo.covers.landscape ??= resourceInfo.covers.portrait
    }

    if (!resourceInfo.covers.splash && fs.pathExistsSync(`${GLOBAL_ASSETS_DIR}/images/${resourceInfo.type}/${resourceInfo.name}/splash.png`)) {
        resourceInfo.covers.splash = `${ASSETS_URL}/assets/images/${resourceInfo.type}/${resourceInfo.name}/splash.png`
    }

    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(6)
        .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/*/**/${DOCUMENT_INFO_FILENAME}`)
        .crawl(`${SOURCE_DIR}`)
        .sync();

    // If resource only contains one document, add documentId and documentIndex to resource level
    // to launch document without individual view screen

    if (documents.length === 1) {
        let document = documents[0]
        let documentInfo = await getDocumentInfoYml(`${SOURCE_DIR}/${document}`)
        resourceInfo.documentId = documentInfo.id
        resourceInfo.documentIndex = documentInfo.index
    }

    if (resourceInfo.externalURL) {
        resourceInfo.kind = RESOURCE_KIND.EXTERNAL
    }

    if (languageInfo.features) {
        let features = { ...languageInfo.features }
        let resourceFeatures = []

        for (let key of Object.keys(features)) {
            features[key].image = `${API_URL()}${API_PREFIX}${features[key].image}`
        }

        if (resourceInfo.features && resourceInfo.features.length) {
            for (let feature of resourceInfo.features) {
                if (feature && features[feature]) {
                    resourceFeatures.push(features[feature])
                }
            }
        }

        let inside_stories = new fdir()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_CONTENT_DIRNAME}/+(0|1|2|3|4|5|6|7|8|9)/inside-story.md`)
            .crawl(`${SOURCE_DIR}/`)
            .sync()

        if (inside_stories.length && features['inside-story']) {
            resourceFeatures.push(features['inside-story'])
        }

        let teacher_comments = new fdir()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/${RESOURCE_CONTENT_DIRNAME}/+(0|1|2|3|4|5|6|7|8|9)/teacher-comments.md`)
            .crawl(`${SOURCE_DIR}/`)
            .sync()

        if (teacher_comments.length && features['teacher-comments']) {
            resourceFeatures.push(features['teacher-comments'])
        }

        let audio = new fdir()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/audio.yml`)
            .crawl(`${SOURCE_DIR}/`)
            .sync()

        if (audio.length && features['audio']) {
            resourceFeatures.push(features['audio'])
        }

        let video = new fdir()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/video.yml`)
            .crawl(`${SOURCE_DIR}/`)
            .sync()

        if (video.length && features['video']) {
            resourceFeatures.push(features['video'])
        }

        let pdf = new fdir()
            .withRelativePaths()
            .withMaxDepth(5)
            .glob(`${resourcePathInfo.language}/${resourcePathInfo.type}/${resourcePathInfo.title}/pdf.yml`)
            .crawl(`${SOURCE_DIR}/`)
            .sync()

        if (pdf.length && features['original_layout']) {
            resourceFeatures.push(features['original_layout'])
        }

        resourceInfo.features = resourceFeatures.filter((thing, index) => {
            const _thing = JSON.stringify(thing)
            return index === resourceFeatures.findIndex(obj => {
                return JSON.stringify(obj) === _thing
            })
        })
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
        let resources = new fdir()
            .withBasePath()
            .withRelativePaths()
            .withMaxDepth(3)
            .glob(`${language}/${resourceType}/**/${RESOURCE_INFO_FILENAME}`)
            .crawl(SOURCE_DIR)
            .sync();

        const resourceFeedConfig = await getResourceFeed(`${SOURCE_DIR}/${language}/${resourceType}/${RESOURCE_FEED_FILENAME}`)

        let resourceFeed = {
            title: resourceFeedConfig.title,
            groups: []
        }

        resourceFeedConfig.groups.map(g => {
            resourceFeed.groups.push({
                ...g,
                title: g.group,
                name: slug(g.group),
                author: g.author || null,
                scope: g.scope || null,
                resources: [],
                resourceIds: g.resources || [],
                view: g.view || FEED_VIEWS.FOLIO,
                recent: g.recent || null,
                type: resourceType,
                direction: g.direction || FEED_DIRECTION.HORIZONTAL,
                id: crypto.createHash("sha256").update(
                    `${language}-${resourceType}-${g.group}`
                ).digest("hex")
            })
        })

        for (let resource of resources) {
            try {
                const resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${resource}`)
                const resourcePathInfo = parseResourcePath(resource)

                let groupByName = resourceFeed.groups.find(g => g.resourceIds.some(i => picomatch(i)(resourceInfo.id) ))
                let groupByAuthor = resourceFeed.groups.find(g => g.author === resourceInfo.author)
                let groupByKind = resourceFeed.groups.find(g => g.kind === resourceInfo.kind)
                let groupByType = resourceFeed.groups.find(g => g.scope === FEED_SCOPES.RESOURCE)

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

        const recentFeedGroup = resourceFeed.groups.find(g => g.recent)

        if (recentFeedGroup && recentFeedGroup.group) {
            const recentFeedGroupAPI = {
                title: recentFeedGroup.group,
                name: slug(recentFeedGroup.group),
                view: recentFeedGroup.view || FEED_VIEWS.SQUARE,
                scope: recentFeedGroup.scope || FEED_SCOPES.RESOURCE,
                resources: [],
                type: resourceType,
                direction: recentFeedGroup.direction || FEED_DIRECTION.HORIZONTAL,
                id: crypto.createHash("sha256").update(
                    `${language}-${resourceType}-recent`
                ).digest("hex")
            }
            await database.collection(FIREBASE_DATABASE_LANGUAGES).doc(language).collection("feed").doc("recent").set(recentFeedGroupAPI);
        }

        resourceFeed.groups = resourceFeed.groups.filter(g => g.resources.length).map(g => {
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

        for (let feedGroup of resourceFeed.groups) {
            let feedGroupAll = { ...feedGroup }
            feedGroupAll.direction = FEED_DIRECTION.VERTICAL
            delete feedGroupAll.backgroundColor
            fs.outputFileSync(`${API_DIST}/${language}/${resourceType}/feeds/${feedGroup.name}/index.json`, JSON.stringify(feedGroupAll))
        }

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
    await processResources(RESOURCE_TYPE.AIJ)
}

export {
    getResourceInfo
}
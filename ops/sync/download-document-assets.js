#!/usr/bin/env node
"use strict"

import process from "node:process"
import crypto from "crypto"
import * as path from "path"
import fs from "fs-extra"
import { escapeAssetPathForSed, parseResourcePath } from "../helpers/helpers.js"
import {
    API_PREFIX,
    API_URL,
    OPS_SYNC_ASSET_EXTENSIONS,
    OPS_SYNC_DETECTED_LINKS_FILENAME, OPS_SYNC_DOWNLOAD_LOCATION,
    OPS_SYNC_TRANSFER_COMMANDS_FILENAME,
    OPS_SYNC_DOWNLOAD_COMMANDS_FILENAME,
    RESOURCE_ASSETS_DIRNAME,
    SOURCE_DIR,
} from "../helpers/constants.js"

let mode = "local"


// workflow
// run mkdir download
// run grep .... command    ggrep -Poir "(http|https)://(?!sabbath-school)[a-zA-Z0-9./?=_%:-]*" --include="*.md" ./src
// run node download-document-assets.js
// run bash download commands.txt
// run aws s3 upload download folder aws s3 cp ./download s3://sabbath-school-stage.adventech.io --acl "public-read" --region us-east-1 --no-progress --recursive --dryrun
// run aws s3 upload from transfer
// run bash transfer commands

if (process && process.env && process.env.GITHUB_TOKEN) {
    mode = "remote"
}

let processDetectedLinks = async function () {
    if (!fs.pathExistsSync(OPS_SYNC_DETECTED_LINKS_FILENAME)) {
        console.log(`No file with the detected links found. Exiting...`)
        return
    }
    const detectedLinks = fs.readFileSync(OPS_SYNC_DETECTED_LINKS_FILENAME, 'utf8').trim().split("\n")

    let links = []

    for (let detectedLink of detectedLinks) {
        let [src, ...link] = detectedLink.split(":")

        if (src && link && link.length === 2) {
            link = link.join(":")
            const srcPath = parseResourcePath(src)
            const linkHash = crypto.createHash('sha256').update(link).digest('hex')
            const extension = path.extname(link)
            let remoteURL = `${API_URL()}${API_PREFIX}${srcPath.language}/${srcPath.type}/${srcPath.title}/${RESOURCE_ASSETS_DIRNAME}/${linkHash}`
            let localURL = `${OPS_SYNC_DOWNLOAD_LOCATION}${API_PREFIX}${srcPath.language}/${srcPath.type}/${srcPath.title}/${RESOURCE_ASSETS_DIRNAME}/${linkHash}`

            if (OPS_SYNC_ASSET_EXTENSIONS.indexOf(extension) >= 0) {
                remoteURL += extension
                localURL += extension
            }

            links.push({
                src,
                link,
                remoteURL,
                localURL
            })
        }
    }

    let downloadCommands = links.map(l => {
        return `curl -C - -L --create-dirs -o "${l.localURL}" ${l.link}`
    })

    let transferCommands = links.map(l => {
        return `sed -i -e 's/${escapeAssetPathForSed(l.link)}/${escapeAssetPathForSed(l.remoteURL)}/g' ${l.src}`
    })

    fs.writeFileSync(OPS_SYNC_DOWNLOAD_COMMANDS_FILENAME, `\n${downloadCommands.join("\n")}`)
    fs.appendFileSync(OPS_SYNC_TRANSFER_COMMANDS_FILENAME, `\n${transferCommands.join("\n")}`)
}

await processDetectedLinks()
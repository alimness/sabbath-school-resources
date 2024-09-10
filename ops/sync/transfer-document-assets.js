#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import { fdir } from "fdir"
import path from "path"
import { getResourceTypesGlob, getNegativeCoverImagesGlob, escapeAssetPathForSed, parseResourcePath } from "../helpers/helpers.js"
import {
    MEDIA_URL,
    SOURCE_DIR,
    RESOURCE_ASSETS_DIRNAME,
    OPS_SYNC_TRANSFER_COMMANDS_FILENAME,
    RESOURCE_CONTENT_DIRNAME,
    DOCUMENT_COVER_FILENAME,
    DOCUMENT_BACKGROUND_FILENAME,
    SECTION_DEFAULT_NAME,
    DOCUMENT_INFO_FILENAME, REMOTE_MEDIA_URL,
} from "../helpers/constants.js"
import process from "node:process"
import yaml from "js-yaml"

let mode = "local"

if (process && process.env && process.env.GITHUB_TOKEN) {
    mode = "remote"
}

let processDocumentCover = async function (documentPathInfo, remoteURL) {
    let documentPath = `${SOURCE_DIR}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${RESOURCE_CONTENT_DIRNAME}/${documentPathInfo.section === SECTION_DEFAULT_NAME ? "" : documentPathInfo.section + "/"}/${documentPathInfo.document}/${DOCUMENT_INFO_FILENAME}`
    let documentInfo = yaml.load(fs.readFileSync(documentPath, "utf8"))
    documentInfo.cover = remoteURL
    if (mode === "remote") fs.outputFileSync(documentPath, yaml.dump(documentInfo))
}

let processDocumentBackground = async function (documentPathInfo, remoteURL) {
    let documentPath = `${SOURCE_DIR}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${RESOURCE_CONTENT_DIRNAME}/${documentPathInfo.section === SECTION_DEFAULT_NAME ? "" : documentPathInfo.section + "/"}/${documentPathInfo.document}/${DOCUMENT_INFO_FILENAME}`
    let documentInfo = yaml.load(fs.readFileSync(documentPath, "utf8"))
    documentInfo.background = remoteURL
    if (mode === "remote") fs.outputFileSync(documentPath, yaml.dump(documentInfo))
}

let transferDocumentAssets = async function () {
    let commands = []

    const documentImageAssets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(8) // up to assets/dir1/dir2/dir3/dir4
        .glob(`**/${getResourceTypesGlob()}/**/(${RESOURCE_ASSETS_DIRNAME}|${RESOURCE_CONTENT_DIRNAME})/${getNegativeCoverImagesGlob()}?(**/)(*.{jpg,jpeg,png,pdf})`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let documentImageAsset of documentImageAssets) {
        documentImageAsset = `${SOURCE_DIR}/${documentImageAsset}`
        let assetResourcePath = parseResourcePath(documentImageAsset)
        let assetDir = `${SOURCE_DIR}/${assetResourcePath.language}/${assetResourcePath.type}/${assetResourcePath.title}/${RESOURCE_CONTENT_DIRNAME}/${assetResourcePath.document}/`

        let targetImage = path.basename(documentImageAsset)

        let remoteURL =
            documentImageAsset.indexOf(`${assetResourcePath.title}/assets`) > 0 ?
            documentImageAsset.replace(`${SOURCE_DIR}`, MEDIA_URL) :
            `${MEDIA_URL}/${assetResourcePath.language}/${assetResourcePath.type}/${assetResourcePath.title}/${RESOURCE_CONTENT_DIRNAME}/${assetResourcePath.section}/${assetResourcePath.document}/${targetImage}`

        if (assetResourcePath.segment === DOCUMENT_COVER_FILENAME) {
            await processDocumentCover(assetResourcePath, remoteURL)
        }

        if (assetResourcePath.segment === DOCUMENT_BACKGROUND_FILENAME) {
            await processDocumentBackground(assetResourcePath, remoteURL)
        }

        /**
         * This command replaces the locally referenced assets in *.md files within the target resource folder
         * with the final destination after it had been uploaded.
         * It tries to match the replacements that has one of these preceding characters. In case if any other character
         * precedes the asset name then it will be replaced. The idea here is to exclude the forwardslash, which will be the
         * preceding character after the replacement.
         *
         * - space - to target yaml reference
         * - semicolon - to target yaml reference
         * - opening square bracket [ - to target audio / video blocks
         * - opening parenthesis ( - to target image block
         *
         * example of the command
         * sed -i '' -e 's/\([ [(:]\)cover.png/\1https:\/\/sabbath-school-stage.adventech.io\/api\/v2\/en\/devo\/bhp-bible-2022\/assets\/cover2.png/g' ./src/en/devo/bhp-bible-2022/**\/*.md
         *
         * The main advantage is almost complete abstraction from the structure and rather heuristically targeting
         * possible ways assets are referenced and replace them. There are disadvantages of this approach
         * as its pretty much impossible to debug and needs update every time there is a new way of referencing an asset
         * in the resource. Additionally, default sed implementation does not support negative lookbehind, hence
         * we are opting into capture groups and putting it in the replacement value (\1)
         *
         * We can always opt out to parsing approach but it will result in
         * - going over the target resources markdown files
         * - parsing every markdown into blocks
         * - replacing the target
         * - trying to reconstruct the block into markdown form
         *
         * All of the above might require substantial amount of coding and slow performance, at least as it seems right
         * now.
         */

        commands.push(`aws s3 cp ${documentImageAsset} ${remoteURL.replace(MEDIA_URL, REMOTE_MEDIA_URL)} --acl "public-read" --region us-east-1 --no-progress`)
        commands.push(`sed -i -e 's/\\([ [(:]\\)${escapeAssetPathForSed(targetImage)}/\\1${escapeAssetPathForSed(remoteURL)}/g' ${assetDir}**/*.md && rm ${documentImageAsset}`)
    }

    fs.writeFileSync(OPS_SYNC_TRANSFER_COMMANDS_FILENAME, `\n${commands.join("\n")}`)
}

await transferDocumentAssets()
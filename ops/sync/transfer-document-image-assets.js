#!/usr/bin/env node
"use strict"

import fs from "fs-extra"
import { fdir } from "fdir"
import { getResourceTypesGlob, getNegativeCoverImagesGlob, escapeAssetPathForSed, parseResourcePath } from "../helpers/helpers.js"
import {
    API_URL,
    API_PREFIX,
    SOURCE_DIR,
    RESOURCE_ASSETS_DIRNAME,
    OPS_SYNC_TRANSFER_COMMANDS_FILENAME,
} from "../helpers/constants.js"

let transferDocumentImageAssets = async function () {
    let commands = []

    // TODO: expand beyond PNG to add JPG and JPEG
    const documentImageAssets = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(8) // up to assets/dir1/dir2/dir3/dir4
        .glob(`**/${getResourceTypesGlob()}/**/assets/${getNegativeCoverImagesGlob()}?(**/*.png)`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let documentImageAsset of documentImageAssets) {
        let assetResourcePath = parseResourcePath(documentImageAsset)
        let assetDir = `${SOURCE_DIR}/${assetResourcePath.language}/${assetResourcePath.type}/${assetResourcePath.title}`
        let targetImage = documentImageAsset.substring(assetDir.length-5 + RESOURCE_ASSETS_DIRNAME.length + 1)
        let remoteURL = `${API_URL()}${API_PREFIX}${assetResourcePath.language}/${assetResourcePath.type}/${assetResourcePath.title}/${RESOURCE_ASSETS_DIRNAME}/${targetImage}`

        /**
         * This command replaces the locally referenced assets in *.md files within the target resource folder
         * with the final destination after its had been uploaded.
         * It tries to match the replacements that has one the these preceding characters. In case if any other character
         * precedes the asset name then it will be replaced. The idea here is to exclude the backslash, which will be the
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

        commands.push(`sed -i '' -e 's/\\([ [(:]\\)${escapeAssetPathForSed(targetImage)}/\\1${escapeAssetPathForSed(remoteURL)}/g' ${assetDir}/**/*.md && rm ${SOURCE_DIR}/${documentImageAsset}`)
    }

    fs.appendFileSync(OPS_SYNC_TRANSFER_COMMANDS_FILENAME, `\n${commands.join("\n")}`)
}

await transferDocumentImageAssets()
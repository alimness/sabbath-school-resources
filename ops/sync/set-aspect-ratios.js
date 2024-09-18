import fs from "fs-extra"
import frontMatter from "front-matter"
import { fdir } from "fdir"
import { parseSegment } from "../helpers/blocks.js"
import { isURL, getBufferFromUrl, getImageRatio, parseResourcePath} from "../helpers/helpers.js"
import {
    RESOURCE_ASSETS_DIRNAME,
    SEGMENT_TYPES,
    RESOURCE_TYPE,
    SOURCE_DIR
} from "../helpers/constants.js"


let getSegmentsWithImageBlocksOnly = async function (document) {
    const segmentFile = fs.readFileSync(document, "utf8");
    const segmentInfoFrontMatter = frontMatter(segmentFile)
    const segmentPathInfo = parseResourcePath(document)

    const segmentInfo = {
        ...segmentInfoFrontMatter.attributes,
    }

    if (!segmentInfo.type || segmentInfo.type === SEGMENT_TYPES.BLOCK) {
        segmentInfo.blocks = await parseSegment(segmentInfoFrontMatter.body, segmentPathInfo, "root",
            1,
            (b) => {
                return b.type === "image"
            })
        segmentInfo.type = SEGMENT_TYPES.BLOCK
    }

    segmentInfo.id = `${segmentPathInfo.language}-${segmentPathInfo.type}-${segmentPathInfo.title}-${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}-${segmentPathInfo.document}`
    segmentInfo.index = `${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${segmentPathInfo.section ? segmentPathInfo.section + "-" : ""}/${segmentPathInfo.document}`

    return segmentInfo
}

let setImageAspectRatios = async function (resourceType) {
    const segments = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(5)
        .glob(`**/${resourceType}/**/*.md`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let segment of segments) {
        let segmentInfo = await getSegmentsWithImageBlocksOnly(`${SOURCE_DIR}/${segment}`, true)
        let segmentRaw = fs.readFileSync(`${SOURCE_DIR}/${segment}`, "utf8");
        let segmentPathInfo = parseResourcePath(segment)

        if (segmentInfo.blocks && segmentInfo.blocks.length) {
            let replace = []
            for (let imageBlock of segmentInfo.blocks) {
                let style = imageBlock.style || {}
                let aspectRatio

                if (!style.image || !style.image.aspectRatio) {
                    if (isURL(imageBlock.src)) {
                        aspectRatio = await getImageRatio(await getBufferFromUrl(imageBlock.src))
                    } else {
                        aspectRatio = await getImageRatio(`${SOURCE_DIR}/${segmentPathInfo.language}/${segmentPathInfo.type}/${segmentPathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${imageBlock.src}`)
                    }
                    if (!style["image"]) {
                        style["image"] = {}
                    }
                    style["image"].aspectRatio = aspectRatio

                    replace.push([
                        new RegExp(`(^\{"style".*\n)?!\\[${imageBlock.caption}\\]\\(${imageBlock.src}\\)`, "gm"),
                        `${JSON.stringify({style})}\n![${imageBlock.caption}](${imageBlock.src})`
                    ])
                }
            }
            if (replace.length) {
                replace.map(r => {
                    segmentRaw = segmentRaw.replace(r[0], r[1])
                })
                fs.outputFileSync(`${SOURCE_DIR}/${segment}`, segmentRaw)
            }
        }
    }
}

await setImageAspectRatios(RESOURCE_TYPE.DEVO)
await setImageAspectRatios(RESOURCE_TYPE.PM)
await setImageAspectRatios(RESOURCE_TYPE.AIJ)

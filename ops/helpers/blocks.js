import crypto from "crypto"
import { marked } from "marked"
import { carousel, slide, image, collapse, audio, video, reference, question, blockquote, hr, heading, list, paragraph, poll, style, superscript } from "./blocks/index.js"

marked.use({
    extensions: [
        carousel.extension,
        slide.extension,
        question.extension,
        collapse.extension,
        image.extension,
        audio.extension,
        video.extension,
        reference.extension,
        poll.extension
    ]
});

let parseBlock = async function (block, resourcePath, index, parentId) {
    let blockStyleReturn = style(block)
    let blockStyle = blockStyleReturn.blockStyle

    block = superscript(blockStyleReturn.block)

    let documentIndex = `${resourcePath.language}/${resourcePath.type}/${resourcePath.name}/content/${resourcePath.section ? resourcePath.section + "/" : ""}${resourcePath.document}`

    block.id = crypto.createHash("sha256").update(
        `${documentIndex}-${parentId}-${block.type}-${index}`
    ).digest("hex")

    const supportedBlockTypes = {
        blockquote,
        audio,
        video,
        image,
        question,
        collapse,
        carousel,
        slide,
        hr,
        reference,
        paragraph,
        heading,
        list,
        poll
    }

    if (supportedBlockTypes[block.type]) {
        let processedBlock = await supportedBlockTypes[block.type].process(block, resourcePath)

        // In certain cases we might decide that we should skip this block, i.e image is referencing local file that
        // does not exist. In this case we will skip it
        if (!processedBlock) { return null }

        return { ...processedBlock, ...blockStyle }
    }

    // If for some reason we encountered a markdown block that we do not know, returning null, i.e skipping
    return null
}

let parseDocument = async function (document, resourcePath, parentId, filter = (b) => b.type !== "space") {
    const blocks = marked.lexer(document).filter(filter)
    let blocksData = []

    for (let [index, block] of blocks.entries()) {
        let indexHash = blocks.filter(b => b.type === block.type).findIndex(b => b === block)
        let blockData = await parseBlock(block, resourcePath, indexHash >= 0 ? indexHash : index, parentId ?? "root")

        if (blockData) {
            blocksData.push(blockData)
        }
    }

    return blocksData
}

export {
    marked,
    parseDocument,
    parseBlock
}
import fs from "fs-extra"
import frontMatter from "front-matter"
import { fdir } from "fdir"
import { parseDocument } from "../helpers/blocks.js"
import { isURL, getBufferFromUrl, getImageRatio, parseResourcePath} from "../helpers/helpers.js"
import {
    RESOURCE_ASSETS_DIRNAME,
    CATEGORY_DEFAULT_NAME,
    DOCUMENT_CONTENT_DIRNAME,
    DOCUMENT_TYPES, RESOURCE_TYPE,
    SOURCE_DIR
} from "../helpers/constants.js"


let getDocumentWithImageBlocksOnly = async function (document) {
    const documentFile = fs.readFileSync(document, "utf8");
    const documentInfoFrontMatter = frontMatter(documentFile)
    const documentPathInfo = parseResourcePath(document)

    const documentInfo = {
        ...documentInfoFrontMatter.attributes,
    }

    if (!documentInfo.type || documentInfo.type === DOCUMENT_TYPES.BLOCK) {
        documentInfo.blocks = await parseDocument(documentInfoFrontMatter.body, documentPathInfo, "root",
            (b) => {
                return b.type === "image"
            })
        documentInfo.type = DOCUMENT_TYPES.BLOCK
    }

    documentInfo.id = `${documentPathInfo.language}-${documentPathInfo.type}-${documentPathInfo.title}-${DOCUMENT_CONTENT_DIRNAME}-${documentPathInfo.section || CATEGORY_DEFAULT_NAME}-${documentPathInfo.document}`
    documentInfo.index = `${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${DOCUMENT_CONTENT_DIRNAME}/${documentPathInfo.section || CATEGORY_DEFAULT_NAME}/${documentPathInfo.document}`

    return documentInfo
}

let setImageAspectRatios = async function (resourceType) {
    const documents = new fdir()
        .withBasePath()
        .withRelativePaths()
        .withMaxDepth(5)
        .glob(`**/${resourceType}/**/*.md`)
        .crawl(SOURCE_DIR)
        .sync();

    for (let document of documents) {
        let documentInfo = await getDocumentWithImageBlocksOnly(`${SOURCE_DIR}/${document}`, true)
        let documentRaw = fs.readFileSync(`${SOURCE_DIR}/${document}`, "utf8");
        let documentPathInfo = parseResourcePath(document)

        if (documentInfo.blocks && documentInfo.blocks.length) {
            let replace = []
            for (let imageBlock of documentInfo.blocks) {
                let style = imageBlock.style || {}
                let aspectRatio

                if (!style.aspectRatio) {
                    if (isURL(imageBlock.src)) {
                        aspectRatio = await getImageRatio(await getBufferFromUrl(imageBlock.src))
                    } else {
                        aspectRatio = await getImageRatio(`${SOURCE_DIR}/${documentPathInfo.language}/${documentPathInfo.type}/${documentPathInfo.title}/${RESOURCE_ASSETS_DIRNAME}/${imageBlock.src}`)
                    }
                    style.aspectRatio = aspectRatio

                    replace.push([
                        new RegExp(`(^\{"style".*\n)?!\\[${imageBlock.caption}\\]\\(${imageBlock.src}\\)`, "gm"),
                        `${JSON.stringify({style})}\n![${imageBlock.caption}](${imageBlock.src})`
                    ])
                }
            }
            if (replace.length) {
                replace.map(r => {
                    documentRaw = documentRaw.replace(r[0], r[1])
                })
                fs.outputFileSync(`${SOURCE_DIR}/${document}`, documentRaw)
            }
        }
    }
}

await setImageAspectRatios(RESOURCE_TYPE.DEVO)
await setImageAspectRatios(RESOURCE_TYPE.PM)

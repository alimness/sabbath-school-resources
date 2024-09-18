import { parseResourcePath } from "../helpers.js"
import { getResourceInfo } from "../../deploy/deploy-resources.js"
import { getDocumentInfoYml } from "../../deploy/deploy-documents.js"
import { RESOURCE_INFO_FILENAME, SOURCE_DIR, FEED_SCOPES } from "../constants.js"

let processReference = async function (block) {
    let referenceTargetPath = parseResourcePath(block.target)
    let reference = { "scope": FEED_SCOPES.RESOURCE }

    if (!referenceTargetPath.language || !referenceTargetPath.type || !referenceTargetPath.title) {
        return false
    }

    if (referenceTargetPath.document) {
        reference.scope = FEED_SCOPES.DOCUMENT
    }

    try {
        const resourceInfo = await getResourceInfo(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${RESOURCE_INFO_FILENAME}`)

        if (reference.scope === FEED_SCOPES.DOCUMENT) {
            const documentInfo = await getDocumentInfoYml(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${referenceTargetPath.section ? referenceTargetPath.section + "/" : ""}${referenceTargetPath.document}/info.yml`)

            reference.title = block.title || documentInfo.title
            reference.subtitle = block.subtitle || documentInfo.subtitle || null
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${referenceTargetPath.section ? referenceTargetPath.section + "-" : ""}/${referenceTargetPath.document.replace(/\*.md$/, "")}`
            reference.document = documentInfo
        } else {
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}`
            reference.title = block.title || resourceInfo.title
            reference.subtitle = block.subtitle || resourceInfo.subtitle || null
        }

        reference.resource = resourceInfo

        return reference
    } catch (e) {
        console.error(`Error processing reference: ${e}`)
        return null
    }
}


export const reference = {
    extension: {
        name: "reference",
        level: "block",
        tokenizer(src, tokens) {
            const rule = /^\{\s*(#|ref)\s*\[([^\]\n\[]+)\]\s*(\([^\n\)\(]+\))?\s*(\([^\n\(\)]+\))?\s*\}([^\n]*)/
            const match = rule.exec(src);
            if (match) {
                return {
                    type: "reference",
                    raw: match[0],
                    target: match[2].trim(),
                    title: match[3] ? match[3].replace(/[\(\)]/g, "").trim() : (match[5] ? match[5].trim() : null),
                    subtitle: match[4] ? match[4].replace(/[\(\)]/g, "").trim() : null,
                };
            }
        },
        renderer(token) {
            // TODO: for web rendering
            return `TODO: reference`;
        }
    },
    process: async function (block) {
        // console.log(block)
        let processedReference = await processReference(block)
        if (!processedReference) return null

        return { id: block.id, type: block.type, target: block.target, ...processedReference}
    },
}
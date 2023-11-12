import { parseResourcePath } from "../helpers.js"
import { CATEGORY_DEFAULT_NAME, RESOURCE_INFO_FILENAME, SOURCE_DIR, FEED_SCOPES, RESOURCE_CONTENT_DIRNAME } from "../constants.js"
import { getResourceInfo } from "../../deploy/deploy-resources.js"
import { getDocumentInfo } from "../../deploy/deploy-documents.js"

let processReference = function (block) {
    let referenceTargetPath = parseResourcePath(block.target)

    let reference = { "scope": FEED_SCOPES.RESOURCE }

    if (!referenceTargetPath.language || !referenceTargetPath.type || !referenceTargetPath.title) {
        return false
    }

    if (referenceTargetPath.document) {
        reference.scope = FEED_SCOPES.DOCUMENT
    }

    if (block.title) {
        return reference
    }

    try {
        const resource = getResourceInfo(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${RESOURCE_INFO_FILENAME}`)

        if (reference.scope === FEED_SCOPES.DOCUMENT) {
            const documentInfo = getDocumentInfo(`${SOURCE_DIR}/${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${RESOURCE_CONTENT_DIRNAME}/${referenceTargetPath.section && referenceTargetPath.section !== CATEGORY_DEFAULT_NAME ? `${referenceTargetPath.section}/` : ""}${referenceTargetPath.document}.md`)

            reference.title = documentInfo.title
            reference.subtitle = resource.title
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}/${RESOURCE_CONTENT_DIRNAME}/${referenceTargetPath.section}/${referenceTargetPath.document.replace(/\*.md$/, "")}`
        } else {
            reference.target = `${referenceTargetPath.language}/${referenceTargetPath.type}/${referenceTargetPath.title}`
            reference.title = resource.title
        }

        return reference
    } catch (e) {
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
        let processedReference = processReference(block)
        if (!processedReference) return null

        return { id: block.id, type: block.type, target: block.target, title: block.title, subtitle: block.subtitle, ...processedReference}
    },
}
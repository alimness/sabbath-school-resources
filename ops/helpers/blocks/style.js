import { validate as jsonSchemaValidate } from "jsonschema"

const styleSchema = {
    "type": "object",
    "additionalProperties": false,
    "properties": {
        // "rounded": {"type": "boolean"},
        // "expandable": {"type": "boolean"},
        // "position": {"type": "string", "enum": ["start", "center", "end"]},
        // "size": {"type": "string", "enum": ["small", "medium", "large"]},
        // "fullBleed": {"type": "boolean"},
        "aspectRatio": { "type": "number" },
        "typeface": { "type": "string" },
    }
}

export const style = function (block) {
    let blockStyle = {}
    let sspmOptionsRegex = /({\s*"style"\s*:.*})/g
    let sspmOptionsMatch = block.raw.match(sspmOptionsRegex)

    if (sspmOptionsMatch && sspmOptionsMatch[0]) {
        try {
            console.log(`matching`, sspmOptionsMatch[0])
            let sspmOptions = JSON.parse(sspmOptionsMatch[0])
            let validateResult = jsonSchemaValidate(sspmOptions.style, styleSchema)
            if (validateResult.errors.length < 1) {
                blockStyle.style = {...sspmOptions.style}
                let replacer = block.type === "image" ? block.raw : block.text
                block.text = replacer.replace(sspmOptionsRegex, "").trim()
            }
        } catch (e) {
            console.log(e)
        }
    }

    return {
        blockStyle,
        block
    }
}
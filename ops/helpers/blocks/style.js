import { validate as jsonSchemaValidate } from "jsonschema"

const styleSchema = {
    "type": "object",
    "additionalProperties": false,
    "properties": {
        "block": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "backgroundColor": { "type": "string" },
                "padding": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "top": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "bottom": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "start": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "end": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                    },"anyOf": [
                        { "required": ["top"], },
                        { "required": ["bottom"], },
                        { "required": ["start"], },
                        { "required": ["send"], },
                    ]
                },
                "margin": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "top": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "bottom": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "start": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                        "end": { "type": "string", "enum": [ "none", "xs", "sm", "base", "lg", "xl", ] },
                    },
                    "anyOf": [
                        { "required": ["top"], },
                        { "required": ["bottom"], },
                        { "required": ["start"], },
                        { "required": ["send"], },
                    ]
                },
            }
        },

        // special block-level styles
        "image": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "aspectRatio": { "type": "number" },
            }
        },
        "text": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "typeface": { "type": "string" },
                "color": { "type": "string" },
                "size": { "type": "string", "enum": [ "xs", "sm", "base", "lg", "xl", ] },
                "align": { "type": "string", "enum": [ "start", "end", "center", ] },
                "offset": { "type": "string", "enum": [ "sup", "sub", ] },
            },
        },

    }
}

export const style = function (block) {
    let blockStyle = {}
    let sspmOptionsRegex = /^({\s*"style"\s*:.*})/g
    let sspmOptionsMatch = block.raw.match(sspmOptionsRegex)

    if (sspmOptionsMatch && sspmOptionsMatch[0]) {
        try {
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
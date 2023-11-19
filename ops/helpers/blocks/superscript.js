export const superscript = function (block) {
    let sspmSuperscript = /(~|<sup>)(.*)(~|<\/sup>)/img
    let sspmSuperscriptMatch = block.raw.match(sspmSuperscript)

    if (sspmSuperscriptMatch && sspmSuperscriptMatch.length > 0) {
        for (let match of sspmSuperscriptMatch) {
            let superscript = match.replace(sspmSuperscript, "$2")
            block.text = block.text.replace(match, `^[${superscript}]({"style":{"text":{"offset": "sup"}}})`).trim()
        }
    }

    let sspmSubscript = /(~|<sub>)(.*)(~|<\/sub>)/img
    let sspmSubscriptMatch = block.raw.match(sspmSubscript)

    if (sspmSubscriptMatch && sspmSubscriptMatch.length > 0) {
        for (let match of sspmSubscriptMatch) {
            let subscript = match.replace(sspmSubscript, "$2")
            block.text = block.text.replace(match, `^[${subscript}]({"style":{"text":{"offset": "sub"}}})`).trim()
        }
    }

    return block
}
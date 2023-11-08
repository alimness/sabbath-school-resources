let superscriptReplacement = function (str) {
    const unicodeMap = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]
    let ret = str
    for (let i = 0; i <= 9; i++) {
        ret = ret.replace(new RegExp(`${i}`, "gm"), unicodeMap[i])
    }
    return ret
}

export const superscript = function (block) {
    let sspmSuperscript = /(~|<sup>)(\d*)(~|<\/sup>)/img
    let sspmSuperscriptMatch = block.raw.match(sspmSuperscript)


    if (sspmSuperscriptMatch && sspmSuperscriptMatch.length > 0) {
        for (let match of sspmSuperscriptMatch) {
            let unicodeNumber = superscriptReplacement(match.replace(sspmSuperscript, "$2"))
            block.text = block.text.replace(match, unicodeNumber).trim()
        }
    }
    return block
}
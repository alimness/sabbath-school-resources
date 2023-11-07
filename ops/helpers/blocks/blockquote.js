import { parseDocument } from "../blocks.js"

export const blockquote = {
    extension: {},
    process: function (block, resourcePath) {
        let blockquote = { id: block.id, type: block.type }
        // memory-verse
        const memoryVerseRegex = /<p>([^<>]+)<\/p>/g
        let memoryVerse = memoryVerseRegex.exec(block.text)
        if (memoryVerse) {
            block.text = block.text.replace(memoryVerseRegex, '').trim()
            blockquote.memoryVerse = true
            blockquote.caption = memoryVerse[1]
        }

        // citation
        const citationRegex = /<cite>([^<>]+)<\/cite>/g
        let citation = citationRegex.exec(block.text)
        if (citation) {
            block.text = block.text.replace(citationRegex, '').trim()
            blockquote.caption = citation[1]
            blockquote.citation = true
        }

        return {...blockquote, items: parseDocument(block.text, resourcePath, block.id) }
    }
}
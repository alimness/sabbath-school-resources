export const heading = {
    extension: {},
    process: function (block, resourcePath) {
        return { id: block.id, type: block.type, markdown: block.text.trim(), depth: block.depth  }
    },
}
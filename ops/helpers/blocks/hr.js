export const hr = {
    extension: {},
    process: function (block, resourcePath) {
        return { id: block.id, type: block.type }
    },
}
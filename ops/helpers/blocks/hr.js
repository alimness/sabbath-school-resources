export const hr = {
    extension: {},
    process: async function (block, resourcePath) {
        return { id: block.id, type: block.type }
    },
}
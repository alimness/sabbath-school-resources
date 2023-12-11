import searchEGW from "@Adventech/egw-tools"

export const getEGWData = async function (resourcePath, text) {
    return await searchEGW.searchEGW(resourcePath.language, text)
}


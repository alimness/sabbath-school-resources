import process from "process"

let DEPLOY_ENV = "stage"

if (process && process.env && process.env.DEPLOY_ENV && process.env.DEPLOY_ENV === "prod") {
    DEPLOY_ENV = "prod"
}

// Directories
export const DIST_DIR = "./dist"
export const SOURCE_DIR = "./src"
export const LANGUAGE_INFO_FILENAME = "info.yml"

export const RESOURCE_TYPE = {
    DEVO: "devo",
    PM: "pm",
}
export const RESOURCE_COLOR_PRIMARY = "#d8d8d8"
export const RESOURCE_COLOR_PRIMARY_DARK = "#949494"
export const RESOURCE_KIND = {
    BOOK: "book",
    DEVOTIONAL: "devotional",
    PLAN: "plan",
    EXTERNAL: "external",
    BLOG: "blog",
    MAGAZINE: "magazine",
}
export const RESOURCE_ORDER = {
    ASC: "asc",
    DESC: "desc",
}
export const RESOURCE_COVERS = {
    PORTRAIT: "cover.png",
    LANDSCAPE: "cover-landscape.png",
    SQUARE: "cover-square.png",
    SPLASH: "splash.png",
}
export const RESOURCE_INFO_FILENAME = "info.yml"
export const RESOURCE_FEED_FILENAME = "feed.yml"
export const RESOURCE_ASSETS_DIRNAME = "assets"
export const RESOURCE_CONTENT_DIRNAME = "content"
export const RESOURCE_FEED_RESOURCE_TYPE = "resource"
export const RESOURCE_FEED_DOCUMENT_TYPE = "document"

// Sections
export const SECTION_INFO_FILENAME = "info.yml"

// Categories
export const CATEGORIES_DIRNAME = "categories"
export const CATEGORY_INFO_FILENAME = "info.yml"
export const CATEGORY_FEED_FILENAME = "feed.yml"
export const CATEGORY_ASSETS_DIRNAME = "assets"
export const CATEGORY_FEED_RESOURCE_TYPE = "resource"
export const CATEGORY_FEED_DOCUMENT_TYPE = "document"
export const CATEGORY_FEED_DEFAULT_TYPE = CATEGORY_FEED_RESOURCE_TYPE

// Authors
export const AUTHORS_DIRNAME = "authors"
export const AUTHORS_FEED_FILENAME = "feed.yml"
export const AUTHORS_FEED_RESOURCE_TYPE = "resource"
export const AUTHORS_INFO_FILENAME = "info.yml"
export const AUTHORS_ASSETS_DIRNAME = "assets"

// Documents
export const DOCUMENT_CONTENT_DIRNAME = "content"
export const DOCUMENT_TYPES = {
    BLOCK: "block",
    PDF: "pdf",
    VIDEO: "video",
}

// API related
export const API_PREFIX = "/api/v2/"
export const API_DIST = `${DIST_DIR}/${API_PREFIX}`
export const API_URL = function () { return `https://sabbath-school${DEPLOY_ENV === "prod" ? "" : "-stage" }.adventech.io` }

// Misc
export const DATE_FORMAT = "DD/MM/YYYY"

export const OPS_DIR = "./ops"
export const OPS_DIR_MANAGE_LANGUAGE_INFO = `${OPS_DIR}/manage/template/language/info.yml`
export const OPS_DIR_MANAGE_RESOURCE_ASSETS = `${OPS_DIR}/manage/template/resource/assets/`
export const OPS_SYNC_TRANSFER_COMMANDS_FILENAME = "transfer_commands.txt"
export const OPS_SYNC_DOWNLOAD_LOCATION = "download"
export const OPS_SYNC_DOWNLOAD_COMMANDS_FILENAME = "download_commands.txt"
export const OPS_SYNC_DETECTED_LINKS_FILENAME = "detected_links.txt"
export const OPS_SYNC_ASSET_EXTENSIONS = [
    ".mp4", ".mp3", ".pdf", ".png", ".jpg", ".jpeg"
]

export const BIBLES_LOCATION = `./node_modules/adventech-bible-tools/bibles`


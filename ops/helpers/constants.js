import process from "process"

export let DEPLOY_ENV = "local"

if (process && process.env && process.env.DEPLOY_ENV) {
    const ENVS = {
        "prod": "prod",
        "stage": "stage"
    }
    DEPLOY_ENV = ENVS[process.env.DEPLOY_ENV] || "stage"
}

// Directories
export const DIST_DIR = "./dist"
export const SOURCE_DIR = "./src"

// Languages
export const LANGUAGE_INFO_FILENAME = "info.yml"

// Resources
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
export const RESOURCE_FONTS_DIRNAME = "fonts"

// Sections
export const SECTION_INFO_FILENAME = "info.yml"
export const SECTION_DIRNAME = "sections"
export const SECTION_TYPES = {
    CHAPTER: "chapter",
    SEGMENT: "segment",
}
export const SECTION_TYPE_DEFAULT = SECTION_TYPES.CHAPTER
export const SECTION_TYPES_BY_RESOURCE_KIND = {
    [RESOURCE_KIND.DEVOTIONAL]: SECTION_TYPES.SEGMENT,
    [RESOURCE_KIND.PLAN]: SECTION_TYPES.SEGMENT,
    [RESOURCE_KIND.BOOK]: SECTION_TYPES.CHAPTER,
    [RESOURCE_KIND.EXTERNAL]: SECTION_TYPES.CHAPTER,
    [RESOURCE_KIND.BLOG]: SECTION_TYPES.CHAPTER,
    [RESOURCE_KIND.MAGAZINE]: SECTION_TYPES.CHAPTER,
}

// Categories
export const CATEGORIES_DIRNAME = "categories"
export const CATEGORY_INFO_FILENAME = "info.yml"
export const CATEGORY_FEED_FILENAME = "feed.yml"
export const CATEGORY_ASSETS_DIRNAME = "assets"
export const CATEGORY_DEFAULT_NAME = "root"

// Authors
export const AUTHORS_DIRNAME = "authors"
export const AUTHORS_FEED_FILENAME = "feed.yml"
export const AUTHORS_INFO_FILENAME = "info.yml"
export const AUTHORS_ASSETS_DIRNAME = "assets"

// Documents
export const DOCUMENT_CONTENT_DIRNAME = "content"
export const DOCUMENT_TYPES = {
    BLOCK: "block",
    PDF: "pdf",
    VIDEO: "video",
}

// TODO: FEED_GROUP_LIMIT

// Feed
export const FEED_VIEWS = {
    TILE: "tile",
    BANNER: "banner",
    SQUARE: "square",
    FOLIO: "folio",
}

export const FEED_DIRECTION = {
    HORIZONTAL: "horizontal",
    VERTICAL: "vertical",
}

export const FEED_SCOPES = {
    RESOURCE: "resource",
    DOCUMENT: "document",
    CATEGORY: "category",
    AUTHOR: "author",
}

// API related
export const API_PREFIX = "/api/v2/"
export const API_DIST = `${DIST_DIR}/${API_PREFIX}`
export const API_URL = function () { return `https://sabbath-school${DEPLOY_ENV === "prod" ? "" : "-stage" }.adventech.io` }
export const MEDIA_URL = `https://sabbath-school-resources-media.adventech.io`
export const FIREBASE_DATABASE_NAME = (DEPLOY_ENV === "prod") ? "https://blistering-inferno-8720.firebaseio.com" : "https://sabbath-school-stage.firebaseio.com"
export const FIREBASE_DATABASE_LANGUAGES = "languages"
export const FIREBASE_DATABASE_RESOURCES = "resources"
export const FIREBASE_DATABASE_BLOCKS = "blocks"
export const FIREBASE_DATABASE_DOCUMENTS = "documents"

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


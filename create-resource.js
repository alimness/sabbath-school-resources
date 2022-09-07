#!/usr/bin/env node

const argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -t [string]')
    .describe('t', 'Title of the resource')
    .describe('k', 'Type of the resource')
    .describe('l', 'Language')
    .describe('n', 'Number of documents in the resource')
    .describe('p', 'Document name prefix')
    .require('t')
    .require('k')
    .require('l')
    .default('k', 'study')
    .default('l', 'en')
    .default('n', 10)
    .argv;

const fs = require("fs-extra");

const resourceTypes = ['pm', 'study']

if (!resourceTypes.includes(argv.k)) {
    console.error('Type of the resource must be one of', resourceTypes)
    return
}

let slug = function (input) {
    return input.replace(/\s/g, '-').replace(/([^A-Za-z0-9\-])|(-$)/g, "").toLowerCase()
};

let pad = function(num, size) {
    let s = num + ""
    while (s.length < size) s = "0" + s
    return s
}

const title = slug(argv.t)
const lang = argv.l
const type = argv.k
const resourcePath = `./src/${lang}/${type}/${title}`
const numDocuments = argv.n
const documentPrefix = argv.p || ""

if (fs.pathExistsSync(`${resourcePath}`)) {
    console.error('Specified resource already exists. Exiting', resourcePath)
    return
}

if (!fs.pathExistsSync(`./src/${lang}`)) {
    console.log('Specified language does not exist. Creating...', lang)
    fs.outputFileSync(`./src/${lang}/info.yml`, `---\nname: ${lang}\ncode: ${lang}`)
}

fs.copySync(`./template/cover.png`, `${resourcePath}/cover.png`)
fs.copySync(`./template/splash.png`, `${resourcePath}/splash.png`)
fs.copySync(`./template/resource-info.yml`, `${resourcePath}/info.yml`)

for(let i = 1; i <= numDocuments; i++) {
    fs.outputFileSync(
        `${resourcePath}/content/${documentPrefix}${pad(i, (Math.max(2, (numDocuments+"").length)))}.md`,
        `---\ntitle: Document ${i}\n---`
    )
}
import { parseBlock } from "../blocks.js"

export const list = {
    extension: {},
    process: function (block, resourcePath) {
        let blockData = { id: block.id, type: block.type, items: [], ordered: block.ordered, start: block.start || 0 }

        for (let [index, listItem] of block.items.entries()) {
            for (let token of listItem.tokens) {
                if (token.type === "text") {
                    blockData.items.push({
                        "type": "list-item",
                        "markdown": token.text.trim()
                    })
                } else {
                    blockData.items.push(
                        parseBlock(token, resourcePath, index, block.id)
                    )
                }
            }
        }

        // Appeal
        if (block.items.length === 1 && block.items[0].task) {
            return blockData = { id: block.id, type: "appeal", markdown: block.items[0].text }
        }

        // Checklist
        if (block.items.length > 1) {
            let multiAppeal = true
            for (let item of block.items) {
                if (item.type !== "list_item") {
                    multiAppeal = false
                    break
                }

                if (item.checked) {
                    multiAppeal = false
                    break
                }

                if (!item.task) {
                    multiAppeal = false
                    break
                }
            }
            if (multiAppeal) {
                return blockData = { ...blockData, type: "checklist" }
            }
        }

        // Multiple choice

        if (block.items.length > 1) {
            let multipleChoice = true
            let checkedNum = 0
            let answer
            for (let [i, item] of block.items.entries()) {
                if (item.type !== "list_item") {
                    multipleChoice = false
                    break
                }

                if (item.checked) {
                    checkedNum++
                    answer = i
                    break
                }

                if (!item.task) {
                    multipleChoice = false
                    break
                }
            }
            if (multipleChoice && checkedNum === 1) {
                return blockData = { ...blockData, answer: answer, type: "multiple-choice" }
            }
        }

        return blockData
    },
}
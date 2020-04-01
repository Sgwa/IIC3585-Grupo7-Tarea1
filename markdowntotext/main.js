const fs = require("fs");
const readline = require("readline");

const input = "input.md";
const output = "output.txt";
const writer = fs.createWriteStream(output, { flags: "w" });
const lines = readline.createInterface({
    input: fs.createReadStream(input)
});

// Lists memory values
let currentOrderedValue = -1;
let currentUnorderedValue = -1;

// Line breaks boolean
let shouldLineBreak = false;

// Code block and identation value
let shouldTab = 0;
let openCodeBlock = false;

const compose = (a, b) => c => a(b(c));

const pipe = functions => data => {
    return functions.reduce((value, func) => func(value), data);
};

// Returns amount of # chars in line
const fetchHeaderSize = line => {
    let count = (line.match(/#/g) || []).length;
    return count;
};

// Checks if line starts with numbers
const startsWithDigit = line => {
    line = line.trim();
    if (line.substring(0, 1).match(/^\d+$/)) {
        return true;
    }
    return false;
};

// Checks if line starts with bullet * and space
const startsWithBullet = line => {
    line = line.trim();
    const symbols = ["*", "-", "+"];
    for (const symbol of symbols) {
        if (line.charAt(0) === symbol && line.charAt(1) === " ") {
            return true;
        }
    }
    return false;
};

// Detects if line is a code block start/end (```, ```python)
const isLimitCodeBlock = line => {
    let count = (line.match(/```/g) || []).length;
    return count === 1;
};

// Checks if line has a block starter
const hasBlockStarter = line => {
    line = line.trim();
    const symbols = ["def", "class", "if", "for"];
    for (const symbol of symbols) {
        if (line.substring(0, 5).includes(symbol)) {
            return true;
        }
    }
    return false;
};

// Checks if line has block ender
const hasBlockEnder = line => {
    line = line.trim();
    const endBlock = ["end"];
    for (const symbol of endBlock) {
        if (line.substring(0, 6).includes(symbol)) {
            return true;
        }
    }
    return false;
};

// Parse code line inside block to indented text
const codeLineToText = line => {
    if (isLimitCodeBlock(line)) {
        let type = codeBlockType(line);
        if (type !== "none") {
            line = line.replace(type, "");
        }
        line = line.replace("```", "");
    } else {
        if (openCodeBlock) {
            // Check identation inside block
            line = line.trim();
            const nextTab = hasBlockStarter(line);
            const nextBack = hasBlockEnder(line);
            if (nextBack) {
                shouldTab--;
            }
            if (shouldTab > 0) {
                const tabs = "\t".repeat(shouldTab);
                line = tabs + line;
            }
            if (nextTab) {
                shouldTab++;
            }
        }
    }
    return line;
};

// Detect code block type
const codeBlockType = line => {
    let type = line.substring(3);
    if (type === "") {
        type = "none";
    }
    openCodeBlock = !openCodeBlock;
    return type;
};

// Parse code highlights to text (`hello` -> hello)
const codeHighlightToText = line => {
    if (!isLimitCodeBlock(line)) {
        line = line.trim();
        let text = line.replace(/`/g, "");
        return text;
    }
    return line;
};

// Converts headers to text format (## Hello -> Hello)
const headersToText = line => {
    let text = line;
    if (!openCodeBlock) {
        line = line.trim();
        const count = fetchHeaderSize(line);
        text = line.substring(count, line.length).trim();
        if (count > 0) {
            text = text + "\n";
        }
    }
    return text;
};

// Converts horizontal rule to text format (*** -> ____)
const horizontalRuleToText = line => {
    if (line === "---" || line === "___" || line === "***") {
        line =
            "__________________________________________________________________________________________";
    }
    return line;
};

// Converts unordered list to text format (* Hello -> \t Hello)
const unorderedListToText = line => {
    if (startsWithBullet(line) && !openCodeBlock) {
        let start = "";
        if (currentUnorderedValue === -1) {
            currentUnorderedValue = 1;
            start = "\n";
        } else {
            currentUnorderedValue++;
        }
        line = start + "\t" + "• " + line.substring(2, line.length);
        return line;
    } else {
        if (currentUnorderedValue > 0) {
            shouldLineBreak = true;
            currentUnorderedValue = -1;
        }
    }
    return line;
};

// Converts ordered list to text format (1. Hello -> \t 1. Hello)
const orderedListToText = line => {
    // line = line.trim();
    if (
        startsWithDigit(line) &&
        (line.match(/./g) || []).length > 0 &&
        !openCodeBlock
    ) {
        parts = line.split(".");
        if (
            (parts[0].match(/^\d+$/) || []).length > 0 &&
            parts[1].charAt(0) === " "
        ) {
            let start = "";
            if (currentOrderedValue === -1) {
                currentOrderedValue = parseInt(parts[0]);
                start = "\n";
            } else {
                currentOrderedValue++;
            }
            line = parts[1].trim();
            line = start + "\t" + currentOrderedValue + ". " + line;
            return line;
        }
    } else {
        if (currentOrderedValue > 0) {
            shouldLineBreak = true;
            currentOrderedValue = -1;
        }
    }
    return line;
};

// pipeline to set all parsing '*ToHtml' functions
const parserPipeline = pipe([
    codeHighlightToText,
    codeLineToText,
    headersToText,
    horizontalRuleToText,
    unorderedListToText,
    orderedListToText
]);

// run pipeline on lines that are not empty and returns the parsed line
const parseLine = line => {
    if (line != "") {
        return parserPipeline(line);
    }
    return line;
};

// write line on the output html
const writeLine = line => {
    if (line != "") {
        if (shouldLineBreak) {
            line = "\n" + line;
            shouldLineBreak = false;
        }
        writer.write(line + "\n");
    }
};

// compose of parseLine and writeLine
const writeParsedLine = compose(writeLine, parseLine);

// parsing and writing line by line
lines.on("line", line => {
    writeParsedLine(line);
});

// write final part of HTML document
lines.on("pause", () => writer.write("\n"));
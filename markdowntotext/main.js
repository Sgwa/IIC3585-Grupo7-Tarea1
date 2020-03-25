const fs = require('fs');
const readline = require('readline');

const input = 'markdowntotext/input.md';
const output = 'markdowntotext/output.txt';
const writer = fs.createWriteStream(output, { flags: 'w' });
const lines = readline.createInterface({
    input: fs.createReadStream(input)
});

let currentOrderedValue = -1;
let currentUnorderedValue = -1;
let shouldLineBreak = false;

const compose = (a, b) => (c) => a(b(c));

const pipe = functions => data => {
    return functions.reduce((value, func) => func(value), data);
};

// Returns amount of # chars in line
const fetchHeaderSize = line => {
    let count = (line.match(/#/g) || []).length;
    return count;
};

// Detects if line is a code block start/end (```, ```python)
const isLimitCodeBlock = line => {
    let count = (line.match(/```/g) || []).length;
    return count === 1;
};

// Converts headers to text format (## Hello -> Hello)
const headersToText = line => {
    line = line.trim();
    const count = fetchHeaderSize(line);
    let text = line.substring(count, line.length).trim();
    if (count > 0) {
        text = text + "\n";
    }
    return text;
};

// Converts horizontal rule to text format (*** -> ____)
const horizontalRuleToText = line => {
    if (line === '---' || line === '___' || line === '***') {
        line = '__________________________________________________________________________________________';
    }
    return line;
};

const startsWithDigit = line => {
    line = line.trim();
    if (line.substring(0, 1).match(/^\d+$/)) {
        return true;
    }
    return false;
};

const startsWithBullet = line => {
    line = line.trim();
    const symbols = ['*', '-', '+'];
    for (const symbol of symbols) {
        if (line.charAt(0) === symbol && line.charAt(1) === ' ') {
            return true;
        }
    }
    return false;
};

// Converts unordered list to text format (* Hello -> \t Hello)
const unorderedListToText = line => {
    if (startsWithBullet(line)) {
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
    if (startsWithDigit(line) && (line.match(/./g) || []).length > 0) {
        parts = line.split(".");
        if ((parts[0].match(/^\d+$/) || []).length > 0 && parts[1].charAt(0) === ' ') {
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
const parserPipeline = pipe([headersToText, horizontalRuleToText, unorderedListToText, orderedListToText]);

// run pipeline on lines that are not empty and returns the parsed line
const parseLine = line => {
    if (line != '') {
        return parserPipeline(line);
    }
    return line;
};

// write line on the output html
const writeLine = line => {
    if (line != '') {
        if (shouldLineBreak) {
            line = '\n' + line;
            shouldLineBreak = false;
        }
        writer.write(line + '\n');
    }
};

// compose of parseLine and writeLine
const writeParsedLine = compose(writeLine, parseLine);

// parsing and writing line by line
lines.on('line', line => {
    writeParsedLine(line);
});

// write final part of HTML document
lines.on('pause', () => writer.write('\n'));
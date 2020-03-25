let fs = require('fs');
const readline = require('readline');

const filePath = 'output.html'

try { // try to remove file if already exists
    fs.unlinkSync(filePath)
} catch {}

// open file to be written
const outputWriter = fs.createWriteStream(filePath, {flags: 'a'})

// write initial part of HTML document
outputWriter.write('<!DOCTYPE html>\n\
<html>\n\
<head>\n\
<title>Markdown to HTML</title>\n\
<script src="https://cdn.jsdelivr.net/gh/google/code-prettify@master/loader/run_prettify.js"></script>\n\
</head>\n\
<body></body>\n');

// line reader for input markdown file
const lineReader = readline.createInterface({
    input: fs.createReadStream('input.MD')
});

// variable to signal if parser is inside a code block
let openCodeBlock = false;

// variable to signal current opened code block type
let openedCodeBLockType = 'block';

// variable to signal if parser is inside a list
let openUnorderedList = false;

const compose = (a, b) => (c) => a(b(c))

const pipe = functions => data => {
    return functions.reduce((value, func) => func(value), data);
};

// counts '#' character to define if will be <h1>, <h2>, etc
const getHeaderType = line => {
    let type = 0;
    line = line.trim()
    for (let i = 1; i <= 6; i++) {
        if (line.charAt(i - 1) === '#') {
            type = i;
        }
    }
    return type;
}

// parse markdown headers to html (# Hello -> <h1>Hello</h1>)
const hToHtml = line => {
    let n = getHeaderType(line)
    if (n > 0 && !openCodeBlock) {
        line = line.substring(n + 1);
        line = `<h${n}>` + line + `</h${n}>`;
    }
    return line;
}


// parse code highlights to html (`hello` -> <code>hello</code>)
const codeHighlightToHtml = line => {
    if (!isLimitCodeBlock(line)) {
        let list = (line.match(/`+/g) || []);
        list.sort((a, b) => b.length - a.length)
        list = [...new Set(list)];
        list.forEach(s => {
            line = line.replace(s, '<code>')
            line = line.replace(s, '</code>')
        });
    }
    return line;
}

// detect if line is a code block start/end (```, ```python)
const isLimitCodeBlock = line => {
    let count = (line.match(/```/g) || []).length;
    return count === 1;
}

// parse code block start/end to html (```python -> <pre class="prettyprint"><code class="language-python">)
const limitCodeBlockToHtml = line => {
    if (isLimitCodeBlock(line)) {
        let type = codeBlockType(line);
        if (type != 'end' && type != 'none') {
            line = line.replace(type, '');
            openedCodeBLockType = type;
        }
        if (type === 'end') {
            line = line.replace('```', `</br></code></pre>`);
            openedCodeBLockType = 'block'
        } else if (openedCodeBLockType === 'block') {
            line = line.replace('```', `<pre class="prettyprint"><code>`);
        } else {
            line = line.replace('```', `<pre class="prettyprint"><code class="language-${openedCodeBLockType}">`);
        }
    }
    return line;
}

// detect code block type
const codeBlockType = line => {
    line = line.substring(3)
    if (line === '') {
        if (openCodeBlock) {
            line = 'end'
        } else {
            line = 'none'
        }
    }
    openCodeBlock = !openCodeBlock;
    return line;
}

// parse horizontal rule to html (*** -> <hr>)
const horizontalRuleToHtml = line => {
    if (line === '---' || line === '___' || line === '***') {
        line = '<hr>'
    }
    return line;
}

// parse unordered lists to html (* first -> <ul><li> first</li>, * second -> <li> second</li>)
const unorderedlistToHtml = line => {
    let characters = ['*', '-', '+'];
    for (c in characters) {
        if (line.charAt(0) === characters[c] && line.charAt(1) === ' ') {
            line = line.substring(1);
            if (!openUnorderedList) {
                line = '<ul>\n<li>' + line + '</li>'
            } else {
                line = '<li>' + line + '</li>'
            }
            openUnorderedList = true;
            break;
        }
    }
    return line;
}

// pipeline to set all parsing '*ToHtml' functions
const parserPipeline = pipe([codeHighlightToHtml, limitCodeBlockToHtml, hToHtml, horizontalRuleToHtml, unorderedlistToHtml]);

// run pipeline on lines that are not empty and returns the parsed line
const parseLine = line => {
    if (line != '') {
        return parserPipeline(line);
    } else if (openUnorderedList) {
        line = '</ul>'
        openUnorderedList = false;
    }
    return line;
}

// write line on the output html
const writeLine = line => {
    if (line != '') {
        if (!openCodeBlock && !openUnorderedList) {
            outputWriter.write('<div>' + line + '</div>\n');
        } else {
            outputWriter.write(' ' + line + '\n');
        }
    }
}

// compose of parseLine and writeLine
const writeParsedLine = compose(writeLine, parseLine);

// parsing and writing line by line
lineReader.on('line', line => {
    writeParsedLine(line);
});

// write final part of HTML document
lineReader.on('pause', () => outputWriter.write('</body>\n</html>'));

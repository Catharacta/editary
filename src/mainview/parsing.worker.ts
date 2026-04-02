import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import markdownItKatex from "markdown-it-katex";
import DOMPurify from "dompurify";

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
});

md.use(taskLists, { enabled: true, label: true, labelAfter: true });
md.use(markdownItKatex);

md.renderer.rules.math_inline = (tokens, idx) => {
    const latex = tokens[idx].content;
    return `<span data-type="math-inline" data-latex="${md.utils.escapeHtml(latex)}"></span>`;
};
md.renderer.rules.math_block = (tokens, idx) => {
    return `<div data-type="math-block">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
};

self.onmessage = (event) => {
    const { markdown } = event.data;
    try {
        const rawHtml = md.render(markdown);
        const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
            ADD_TAGS: ["details", "summary", "kbd", "mark", "ruby", "rt", "rp"],
            ADD_ATTR: ["align", "color", "style"],
        });
        self.postMessage({ html: sanitizedHtml });
    } catch (error: any) {
        self.postMessage({ error: error.message });
    }
};

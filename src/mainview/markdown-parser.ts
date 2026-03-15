import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import markdownItKatex from "markdown-it-katex";

// ========================================
// Markdown → HTML  (for loading into Tiptap)
// ========================================
const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
});

// Enable GFM tables (built-in to markdown-it) — already enabled by default.
// Enable task-list checkboxes: `- [x] done` / `- [ ] todo`
md.use(taskLists, { enabled: true, label: true, labelAfter: true });

// Enable math parsing ($ inline $, $$ block $$)
md.use(markdownItKatex);

// Override math renderers to output custom HTML for Tiptap instead of rendered KaTeX
md.renderer.rules.math_inline = (tokens, idx) => {
    const latex = tokens[idx].content;
    return `<span data-type="math-inline" data-latex="${md.utils.escapeHtml(latex)}"></span>`;
};
md.renderer.rules.math_block = (tokens, idx) => {
    return `<div data-type="math-block">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
};

// Mermaid fences are handled as standard <pre><code class="language-mermaid">
// by markdown-it's default fence renderer — no override needed.

/**
 * Convert a Markdown string to HTML for loading into Tiptap.
 */
export function markdownToHtml(markdown: string): string {
    return md.render(markdown);
}

// ========================================
// HTML → Markdown  (for saving to disk)
// ========================================
const turndown = new TurndownService({
    headingStyle: "atx",          // # Heading
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",     // ```code```
    emDelimiter: "*",
    strongDelimiter: "**",
});

// Enable GFM support: tables, task lists, strikethrough
turndown.use(gfm);

// Custom rule: preserve task-list checkboxes
// markdown-it-task-lists renders <input type="checkbox"> inside <li>
turndown.addRule("taskListItem", {
    filter: (node) => {
        return (
            node.nodeName === "LI" &&
            node.parentElement?.getAttribute("class")?.includes("contains-task-list") === true
        );
    },
    replacement: (content, node) => {
        const li = node as HTMLLIElement;
        const checkbox = li.querySelector('input[type="checkbox"]');
        const checked = checkbox?.hasAttribute("checked") ?? false;
        // Strip the rendered checkbox text and clean up content
        const cleanContent = content
            .replace(/^\s*\[[ x]\]\s*/i, "")  // Remove any already-converted checkbox markers
            .replace(/^\s+/, "")               // Trim leading whitespace
            .trim();
        return `- [${checked ? "x" : " "}] ${cleanContent}\n`;
    },
});

turndown.addRule("mathInline", {
    filter: (node) => node.nodeName === "SPAN" && node.getAttribute("data-type") === "math-inline",
    replacement: (content, node) => {
        const latex = (node as HTMLElement).getAttribute("data-latex") || node.textContent || "";
        return `$${latex}$`;
    },
});

turndown.addRule("mathBlock", {
    filter: (node) => node.nodeName === "DIV" && node.getAttribute("data-type") === "math-block",
    replacement: (content, node) => {
        return `\n\n$$\n${node.textContent}\n$$\n\n`;
    },
});

// Mermaid blocks use standard <pre><code class="language-mermaid"> —
// Turndown handles these natively as fenced code blocks.

/**
 * Convert HTML back to Markdown string.
 * Uses Turndown with GFM plugin for reliable roundtrip conversion.
 */
export function htmlToMarkdown(html: string): string {
    let markdown = turndown.turndown(html);
    // Clean up excessive blank lines
    markdown = markdown.replace(/\n{3,}/g, "\n\n");
    return markdown.trim();
}

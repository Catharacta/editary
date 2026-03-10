import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

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

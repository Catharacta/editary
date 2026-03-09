import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
});

/**
 * Convert a Markdown string to HTML for loading into Tiptap.
 */
export function markdownToHtml(markdown: string): string {
    return md.render(markdown);
}

/**
 * Convert HTML back to a simplified Markdown string.
 * This is a basic implementation; for production use,
 * consider turndown or a more robust HTML-to-MD library.
 */
export function htmlToMarkdown(html: string): string {
    let md = html;

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

    // Bold / Italic / Strike
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~");

    // Inline code
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

    // Code blocks
    md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
        const lines = content.replace(/<\/?p[^>]*>/gi, "").trim().split("\n");
        return lines.map((l: string) => `> ${l.trim()}`).join("\n") + "\n\n";
    });

    // Lists
    md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gis, "- $1\n") + "\n";
    });
    md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, content) => {
        let index = 0;
        return (
            content.replace(/<li[^>]*>(.*?)<\/li>/gis, () => {
                index++;
                return `${index}. ${arguments[1]}\n`;
            }) + "\n"
        );
    });

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

    // Images
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");

    // Horizontal rule
    md = md.replace(/<hr[^>]*\/?>/gi, "---\n\n");

    // Paragraphs and line breaks
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, "$1\n\n");
    md = md.replace(/<br[^>]*\/?>/gi, "\n");

    // Strip remaining tags
    md = md.replace(/<[^>]+>/g, "");

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, "\n\n");
    md = md.trim();

    return md;
}

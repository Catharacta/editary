import { Node, Mark, mergeAttributes } from "@tiptap/core";

/**
 * Generic Mark for simple HTML tags like kbd, mark, etc.
 */
const createHtmlMark = (name: string, tagName: string) => {
    return Mark.create({
        name,
        parseHTML() {
            return [{ tag: tagName }];
        },
        renderHTML({ HTMLAttributes }) {
            return [tagName, mergeAttributes(HTMLAttributes), 0];
        },
    });
};

export const Kbd = createHtmlMark("kbd", "kbd");
export const MarkTag = createHtmlMark("mark", "mark");
export const Underline = createHtmlMark("underline", "u");

/**
 * Details/Summary Node
 */
export const Details = Node.create({
    name: "details",
    group: "block",
    content: "summary block*",
    parseHTML() {
        return [{ tag: "details" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["details", mergeAttributes(HTMLAttributes), 0];
    },
});

export const Summary = Node.create({
    name: "summary",
    group: "block",
    content: "inline*",
    parseHTML() {
        return [{ tag: "summary" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["summary", mergeAttributes(HTMLAttributes), 0];
    },
});

/**
 * Ruby/RT/RP Nodes for furigana
 */
export const Ruby = Node.create({
    name: "ruby",
    group: "inline",
    inline: true,
    content: "inline*",
    parseHTML() {
        return [{ tag: "ruby" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["ruby", mergeAttributes(HTMLAttributes), 0];
    },
});

export const Rt = Node.create({
    name: "rt",
    group: "inline",
    inline: true,
    content: "inline*",
    parseHTML() {
        return [{ tag: "rt" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["rt", mergeAttributes(HTMLAttributes), 0];
    },
});

/**
 * RawHtml fallback to keep unsupported tags
 */
export const RawHtml = Node.create({
    name: "rawHtml",
    group: "block",
    content: "inline*",
    inline: false,
    addAttributes() {
        return {
            tagName: {
                default: "div",
            },
            attrs: {
                default: {},
            },
        };
    },
    parseHTML() {
        // This is a catch-all for div, span with styles/align
        return [
            { tag: "div[align]" },
            { tag: "div[style]" },
            { tag: "span[style]" },
        ];
    },
    renderHTML({ HTMLAttributes, node }) {
        const { tagName, ...rest } = HTMLAttributes;
        return [HTMLAttributes.tagName || "div", mergeAttributes(rest), 0];
    },
});

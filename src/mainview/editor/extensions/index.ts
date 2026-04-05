import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import SearchAndReplace from "@sereneinserenade/tiptap-search-and-replace";
import CharacterCount from "@tiptap/extension-character-count";
import BubbleMenu from "@tiptap/extension-bubble-menu";

// Custom Extensions
import { MathBlock } from "./math-block";
import { MathInline } from "./math-inline";
import { EditaryCodeBlock } from "./mermaid-block";
import { Kbd, MarkTag, Underline, Details, Summary, Ruby, Rt, RawHtml } from "./html-tags";
import { ImageHandlerExtension } from "./ImageHandler";
import { SlashCommandsExtension } from "./SlashCommands";
import { CustomImage } from "./CustomImage";

/**
 * Returns the full list of Tiptap extensions configured for Editary.
 */
export function getExtensions(options: { tableBubbleMenu?: HTMLElement | null } = {}) {
    const extensions: any[] = [
        MathBlock,
        MathInline,
        EditaryCodeBlock,
        Kbd,
        MarkTag,
        Underline,
        Details,
        Summary,
        Ruby,
        Rt,
        RawHtml,
        StarterKit.configure({
            link: false,
            codeBlock: false,
            heading: { levels: [1, 2, 3, 4, 5, 6] },
            blockquote: { HTMLAttributes: { class: "neo-blockquote" } },
            horizontalRule: { HTMLAttributes: { class: "neo-hr" } },
        }),
        TextAlign.configure({
            types: ["tableCell", "tableHeader"],
            alignments: ["left", "center", "right"],
        }),
        Link.configure({
            openOnClick: false,
            HTMLAttributes: { class: "neo-link" },
        }),
        Placeholder.configure({
            placeholder: "Write something...",
            includeChildren: true,
        }),
        CustomImage,
        Typography,
        Table.configure({
            resizable: true,
            HTMLAttributes: { class: "neo-table" },
        }),
        TableRow,
        TableCell.configure({ HTMLAttributes: { class: "neo-table-cell" } }),
        TableHeader.configure({ HTMLAttributes: { class: "neo-table-header" } }),
        TaskList.configure({ HTMLAttributes: { class: "neo-task-list" } }),
        TaskItem.configure({ nested: true, HTMLAttributes: { class: "neo-task-item" } }),
        SearchAndReplace.configure({ searchResultClass: 'search-result' }),
        CharacterCount,
        ImageHandlerExtension,
        SlashCommandsExtension,
    ];

    if (options.tableBubbleMenu) {
        extensions.push(
            BubbleMenu.configure({
                pluginKey: "tableBubbleMenu",
                element: options.tableBubbleMenu,
                shouldShow: ({ editor }) => editor.isActive("table"),
                // @ts-ignore
                tippyOptions: { duration: 100, placement: "bottom", interactive: true },
            })
        );
    }

    return extensions;
}

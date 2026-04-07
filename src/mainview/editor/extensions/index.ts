import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import BulletList from "@tiptap/extension-bullet-list";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import { wrappingInputRule, InputRule } from "@tiptap/core";
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
 * Custom ListItem that handles conversion to TaskItem on '[' key.
 */
const CustomListItem = ListItem.extend({
    addKeyboardShortcuts() {
        return {
            '[': ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;
                
                // If we're at the very beginning of a bullet list item
                if (editor.isActive('bulletList') && $from.parentOffset === 0) {
                    // Convert this list item to a task list item
                    return editor.commands.toggleTaskList();
                }
                
                return false;
            },
        };
    },
});

/**
 * Custom BulletList with smarter InputRules.
 * It waits for a non-space, non-[ character after hyphen-space before converting.
 */
const CustomBulletList = BulletList.extend({
    addInputRules() {
        return [
            // Delayed Bullet List Rule: Matches '- ' and then any character except '[' or Space
            // It replaces the matched part with a list item containing the typed character.
            new InputRule({
                find: /^\s*([-+*])\s([^\s\[])$/,
                handler: ({ state, range, match }) => {
                    const char = match[2];
                    const { tr } = state;
                    
                    // Delete the range where ' - a' was typed
                    tr.delete(range.from, range.to);
                    // Insert the character
                    tr.insertText(char, range.from);
                    
                    // Apply toggleBulletList command via the editor
                    // Note: handler gets 'state', 'range', 'match'. To use commands, we need the editor instance.
                    // Extensions can use this.editor
                    this.editor.commands.toggleBulletList();
                    
                    return null;
                },
            }),
        ];
    },
});

/**
 * Custom TaskItem that handles "- [ ] " pattern correctly.
 */
const CustomTaskItem = TaskItem.extend({
    addInputRules() {
        return [
            // Rule to handle "- [ ] " and "- [x] " completion
            new InputRule({
                find: /^\s*([-+*])\s+\[([ xX])\]\s$/,
                handler: ({ state, range, match }) => {
                    // Toggle task list
                    this.editor.chain().focus()
                        .deleteRange(range)
                        .toggleTaskList()
                        .updateAttributes('taskItem', { checked: match[2].toLowerCase() === 'x' })
                        .run();
                    return null;
                },
            }),
            // Rule to handle "[ ] " (already in standard, but let's be explicit if needed)
        ];
    },
});

/**
 * Returns the full list of Tiptap extensions configured for Editary.
 */
export function getExtensions(options: { tableBubbleMenu?: HTMLElement | null } = {}) {
    const extensions: any[] = [
        MathBlock,
        MathInline,
        EditaryCodeBlock,
        TaskList.configure({ HTMLAttributes: { class: "neo-task-list" } }),
        CustomTaskItem.configure({ nested: true, HTMLAttributes: { class: "neo-task-item" } }),
        CustomListItem,
        CustomBulletList.configure({ HTMLAttributes: { class: "neo-bullet-list" } }),
        OrderedList.configure({ HTMLAttributes: { class: "neo-ordered-list" } }),
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
            bulletList: false, // Use our CustomBulletList instead
            orderedList: false,
            listItem: false,
            horizontalRule: { HTMLAttributes: { class: "neo-hr" } },
            heading: { levels: [1, 2, 3, 4, 5, 6] },
            blockquote: { HTMLAttributes: { class: "neo-blockquote" } },
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

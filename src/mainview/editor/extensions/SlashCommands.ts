import { Extension, InputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { handleImageInsert } from "./ImageHandler";

/**
 * Tiptap Extension for slash commands like /image and /table.
 */
export const SlashCommandsExtension = Extension.create({
    name: "slashCommands",
    addInputRules() {
        return [
            // /image command
            new InputRule({
                find: /(?:^|\s)\/image\s$/,
                handler: ({ state, range }) => {
                    const { tr } = state;
                    tr.delete(range.from, range.to);
                    this.editor.view.dispatch(tr);

                    // Trigger file picker
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                            handleImageInsert(this.editor, file);
                        }
                    };
                    input.click();
                },
            }),
            // /table command
            new InputRule({
                find: /(?:^|\s)\/table\s$/,
                handler: ({ state, range }) => {
                    const { tr } = state;
                    const { schema } = state;

                    // Deleting the "/table " command
                    tr.delete(range.from, range.to);

                    // Create the table structure logically (2x3 table)
                    const table = schema.nodes.table.create({}, [
                        schema.nodes.tableRow.create({}, [
                            schema.nodes.tableHeader.create({}, [schema.nodes.paragraph.create()]),
                            schema.nodes.tableHeader.create({}, [schema.nodes.paragraph.create()]),
                        ]),
                        schema.nodes.tableRow.create({}, [
                            schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                            schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                        ]),
                        schema.nodes.tableRow.create({}, [
                            schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                            schema.nodes.tableCell.create({}, [schema.nodes.paragraph.create()]),
                        ]),
                    ]);

                    // Insert at the command's position
                    tr.insert(range.from, table);

                    // Set selection precisely to the head of the first cell
                    const firstCellPos = range.from + 3;
                    const $pos = tr.doc.resolve(firstCellPos);
                    tr.setSelection(TextSelection.near($pos));
                    
                    this.editor.view.dispatch(tr);

                    // Fix for BubbleMenu position sync
                    window.requestAnimationFrame(() => {
                        this.editor.view.focus();
                    });
                },
            }),
        ];
    },
});

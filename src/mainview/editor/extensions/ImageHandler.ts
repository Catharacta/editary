import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";
import { Editor } from "@tiptap/core";
import { electroview } from "../../ipc";
import { state } from "../../state/workspace";

/**
 * Tiptap Extension to handle drag and drop / paste for images.
 */
export const ImageHandlerExtension = Extension.create({
    name: "imageHandler",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    // @ts-ignore: Tiptap types might not include all ProseMirror props
                    handleDragOver: (view: EditorView, event: DragEvent) => {
                        event.preventDefault();
                        return false;
                    },
                    handleDrop: (view: EditorView, event: DragEvent) => {
                        if (event.dataTransfer?.files?.length) {
                            const file = event.dataTransfer.files[0];
                            if (file.type.startsWith("image/")) {
                                handleImageInsert(this.editor, file);
                                return true;
                            }
                        }
                        return false;
                    },
                    handlePaste: (view: EditorView, event: ClipboardEvent) => {
                        const items = event.clipboardData?.items;
                        if (items) {
                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.startsWith("image/")) {
                                    const file = items[i].getAsFile();
                                    if (file) {
                                        handleImageInsert(this.editor, file);
                                        return true;
                                    }
                                }
                            }
                        }
                        return false;
                    },
                },
            }),
        ];
    },
});

/**
 * Handle image file insertion (Drop or Paste).
 * If a file path exists, save to assets/. If not (Untitled), keep as Base64.
 */
export async function handleImageInsert(editor: Editor, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
        const base64Data = reader.result as string;

        if (state.currentFilePath && electroview.rpc) {
            // Document has a path - save to assets/
            const targetDir = state.currentFilePath.replace(/[\\/][^\\/]*$/, "") || ".";
            const response = await electroview.rpc.request.saveImage({
                targetDir,
                fileName: file.name,
                base64Data
            });

            if (response.success) {
                // Use base64 for immediate preview, but store relative path for saving
                editor.chain().focus().setImage({ 
                    src: base64Data,
                    // @ts-ignore: custom attribute
                    "data-original-src": response.relativePath 
                }).run();
            } else {
                console.error("Failed to save image:", response.error);
                // Fallback to Base64 if saving fails
                editor.chain().focus().setImage({ src: base64Data }).run();
            }
        } else {
            // Untitled document - keep as Base64 for now
            editor.chain().focus().setImage({ src: base64Data }).run();
        }
    };
    reader.readAsDataURL(file);
}

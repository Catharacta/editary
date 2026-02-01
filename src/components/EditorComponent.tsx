import React, { useEffect, useRef } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import './EditorComponent.css';

const EditorComponent: React.FC = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        if (!editorRef.current) return;

        // Extensions configuration
        const extensions: Extension[] = [
            lineNumbers(),
            highlightActiveLine(),
            history(),
            highlightSelectionMatches(),
            markdown(),
            oneDark, // Default theme for now
            keymap.of([
                ...defaultKeymap,
                ...historyKeymap,
                ...searchKeymap
            ])
        ];

        // Create initial state
        const state = EditorState.create({
            doc: "# Welcome to Editary\n\nStart typing...",
            extensions: extensions
        });

        // Create view
        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    return (
        <div className="editor-container" ref={editorRef} />
    );
};

export default EditorComponent;

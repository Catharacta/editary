import React, { useEffect, useRef } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore } from '../store';
import './EditorComponent.css';

const EditorComponent: React.FC = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    // Dependencies from Store
    const {
        tabs,
        activeTabId,
        theme,
        updateTabContent,
        setEditorState,
        setCursorPos
    } = useAppStore();

    const activeTab = tabs.find(t => t.id === activeTabId);

    // Refs for callbacks
    const activeTabIdRef = useRef(activeTabId);
    const updateTabContentRef = useRef(updateTabContent);
    const setEditorStateRef = useRef(setEditorState);
    const setCursorPosRef = useRef(setCursorPos);

    useEffect(() => {
        activeTabIdRef.current = activeTabId;
        updateTabContentRef.current = updateTabContent;
        setEditorStateRef.current = setEditorState;
        setCursorPosRef.current = setCursorPos;
    }, [activeTabId, updateTabContent, setEditorState, setCursorPos]);

    // Compartments for dynamic configuration
    const themeCompartment = useRef(new Compartment());
    const listenerCompartment = useRef(new Compartment());

    // Initialize View
    useEffect(() => {
        if (!editorRef.current) return;

        const updateListener = EditorView.updateListener.of((update) => {
            // Update Cursor Position
            if (update.selectionSet) {
                const state = update.state;
                const pos = state.selection.main.head;
                const line = state.doc.lineAt(pos);
                setCursorPosRef.current({
                    line: line.number,
                    col: pos - line.from + 1
                });
            }

            if (update.docChanged || update.selectionSet) {
                const currentId = activeTabIdRef.current;
                if (!currentId) return;

                if (update.docChanged) {
                    const content = update.state.doc.toString();
                    updateTabContentRef.current(currentId, content, true);
                }
                setEditorStateRef.current(currentId, update.state);
            }
        });

        const initialExtensions: Extension[] = [
            lineNumbers(),
            highlightActiveLine(),
            history(),
            highlightSelectionMatches(),
            markdown(),
            // Theme Compartment
            themeCompartment.current.of(theme === 'dark' ? oneDark : []),
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
            // Listener Compartment
            listenerCompartment.current.of(updateListener)
        ];

        const state = EditorState.create({
            doc: "",
            extensions: initialExtensions
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Run once on mount

    // Handle Theme Change
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        // Dispatch effect to reconfigure theme compartment
        view.dispatch({
            effects: themeCompartment.current.reconfigure(
                theme === 'dark' ? oneDark : [] // Empty array for default light theme
            )
        });
    }, [theme]);

    // Handle Active Tab Change
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;

        if (!activeTab) {
            // Clear content if no tab
            view.setState(EditorState.create({ doc: "", extensions: [] }));
            return;
        }

        // Restore state or create new
        if (activeTab.editorState) {
            // Only set state if different to avoid reset loop
            if (view.state !== activeTab.editorState) {
                view.setState(activeTab.editorState);

                // Re-apply theme if the stored state had old theme config?
                // Actually EditorState contains the configuration.
                // If we restore state, we restore its config too.
                // So we might need to verify if theme matches current global theme.
                // But for now, let's assume simple restore. 
                // A better approach for robust theme switching on restore is to NOT store theme in Tab State 
                // but inject it cleanly.
                // Since we use compartments in the *View* (managed by us here via dispatch), 
                // simply setState might overwrite the compartment structure if the restored state didn't have it?
                // Yes, setState replaces the entire state.

                // If we just do `view.setState(activeTab.editorState)`, we lose the *current* compartment references 
                // if they are not identical.
                // Actually, if we use the same compartments, it might work.

                // Workaround: After restore, confirm theme.
                // But wait, `activeTab.editorState` was saved *with* the Compartment logic active.
                // So it should be fine.
            }
        } else {
            // Create new State for new tab
            // We must re-use the SAME listener/theme logic

            const updateListener = EditorView.updateListener.of((update) => {
                if (update.selectionSet) {
                    const state = update.state;
                    const pos = state.selection.main.head;
                    const line = state.doc.lineAt(pos);
                    setCursorPosRef.current({
                        line: line.number,
                        col: pos - line.from + 1
                    });
                }
                if (update.docChanged || update.selectionSet) {
                    const currentId = activeTabIdRef.current;
                    if (!currentId) return;

                    if (update.docChanged) {
                        updateTabContentRef.current(currentId, update.state.doc.toString(), true);
                    }
                    setEditorStateRef.current(currentId, update.state);
                }
            });

            const extensions: Extension[] = [
                lineNumbers(),
                highlightActiveLine(),
                history(),
                highlightSelectionMatches(),
                markdown(),
                themeCompartment.current.of(theme === 'dark' ? oneDark : []),
                keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
                listenerCompartment.current.of(updateListener)
            ];

            const newState = EditorState.create({
                doc: activeTab.content || "",
                extensions
            });

            view.setState(newState);
            setEditorState(activeTab.id, newState);
        }

        // Ensure theme is correct (in case stored state had old theme)
        view.dispatch({
            effects: themeCompartment.current.reconfigure(
                theme === 'dark' ? oneDark : []
            )
        });

        view.focus();

    }, [activeTabId]); // Only when ID changes

    return (
        <div className="editor-container" ref={editorRef} />
    );
};

export default EditorComponent;

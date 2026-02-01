import React, { useEffect, useRef, useState } from 'react';
import { EditorState, Extension, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore } from '../store';
import './EditorComponent.css';

const EditorComponent: React.FC = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState<EditorView | null>(null);

    // Store State
    const {
        tabs,
        activeTabId,
        theme,
        updateTabContent,
        setEditorState,
        setCursorPos
    } = useAppStore();

    // Derived State
    const activeTab = tabs.find(t => t.id === activeTabId);

    // Refs for stable callbacks
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

    // Compartments
    const themeCompartment = useRef(new Compartment());
    const listenerCompartment = useRef(new Compartment());

    // --- Initialization Logic ---
    // This component is now re-mounted whenever activeTabId changes (due to Key in App.tsx)
    useEffect(() => {
        if (!editorRef.current) return;
        if (!activeTab) return; // Should likely be handled by parent or return null, but check safely

        // 1. Definition of update listener
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
                if (currentId) {
                    if (update.docChanged) updateTabContentRef.current(currentId, update.state.doc.toString(), true);
                    setEditorStateRef.current(currentId, update.state);
                }
            }
        });

        // 2. Extensions Configuration
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

        // 3. State Creation
        // If we have a saved EditorState, restore it. Otherwise create from content.
        let state: EditorState;
        if (activeTab.editorState) {
            // Restore functionality logic:
            // EditorState.fromJSON() isn't used here because we store the object reference in memory (Zustand).
            // However, we must ensure the 'extensions' are re-applied or compatible?
            // A stored EditorState *contains* its configuration (facets, fields).
            // If we re-use it, we keep the history and config. 
            // BUT, our "refs" in the listeners (stored in compartments/fields) might be stale closures?
            // WE are using `activeTabIdRef` which is updated by the side-effect.
            // AND we wrap the listener in a compartment. 
            // Ideally, we should Reconfigure the listener compartment on restore?
            // Actually, if we use the *same* state object, it has the *old* extensions.
            // We need to be careful. 

            // Simplest robust approach for MVP without complex Reconfiguration:
            // Just re-create state from content if we don't care about precise Undo stack persistence across tab switches *deeply*.
            // BUT requirement says "Undo/Redo history preserved". 
            // So we MUST use `activeTab.editorState`.

            state = activeTab.editorState;

            // Warning: If we re-use state, the `updateListener` embedded in it is the OLD function from previous mount.
            // That old function uses the OLD `activeTabIdRef`.
            // Does strictly `activeTabIdRef` survive? 
            // It is a Ref object. If the Component unmounts, the Ref object is lost (garbage collected eventually).
            // The old listener closure holds a reference to the OLD Ref object.
            // That OLD Ref object will NOT be updated by the NEW Component instance.
            // THIS is the danger of re-using EditorState object with closure-based listeners across React remounts.

            // FIX: We must RECONFIGURE the listener compartment immediately after restoring state.
            // This injects the NEW listener (bound to NEW Refs).
        } else {
            state = EditorState.create({
                doc: activeTab.content,
                extensions: extensions
            });
        }

        // 4. View Creation
        const newView = new EditorView({
            state,
            parent: editorRef.current
        });

        // 5. Post-Restore Fixup (Reconfigure Listener to use fresh Refs)
        if (activeTab.editorState) {
            newView.dispatch({
                effects: listenerCompartment.current.reconfigure(updateListener)
            });
            // Also ensure Theme matches current preference (state might have old theme)
            newView.dispatch({
                effects: themeCompartment.current.reconfigure(theme === 'dark' ? oneDark : [])
            });
        }

        setView(newView);
        // Save initial state if new
        if (!activeTab.editorState) {
            setEditorStateRef.current(activeTab.id, state);
        }

        return () => {
            newView.destroy();
            setView(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount (which happens on every tab switch now)

    // --- Effects ---

    // 1. Theme Change
    useEffect(() => {
        if (!view) return;
        view.dispatch({
            effects: themeCompartment.current.reconfigure(
                theme === 'dark' ? oneDark : []
            )
        });
    }, [theme, view]);

    // 2. External Content Reload (Same Tab, Version increased)
    // Since we unmount on Tab Change, this only handles "Reload" while active.
    const renderedVersionRef = useRef<number>(activeTab?.contentVersion || 0);

    useEffect(() => {
        if (!view || !activeTab) return;

        if (activeTab.contentVersion > renderedVersionRef.current) {
            const transaction = view.state.update({
                changes: { from: 0, to: view.state.doc.length, insert: activeTab.content }
            });
            view.dispatch(transaction);
            renderedVersionRef.current = activeTab.contentVersion;
        }
    }, [activeTab?.contentVersion, view, activeTab]);

    // 3. Undo/Redo Events
    useEffect(() => {
        const handleUndo = () => { if (view) undo(view); };
        const handleRedo = () => { if (view) redo(view); };
        window.addEventListener('editor:undo', handleUndo);
        window.addEventListener('editor:redo', handleRedo);
        return () => {
            window.removeEventListener('editor:undo', handleUndo);
            window.removeEventListener('editor:redo', handleRedo);
        };
    }, [view]);

    // --- Render ---
    if (!activeTab) {
        return (
            <div className="editor-container empty-state">
                <div className="empty-message">No file is open</div>
            </div>
        );
    }

    return (
        <div className="editor-container" ref={editorRef} />
    );
};

export default EditorComponent;

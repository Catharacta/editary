import { Compartment } from '@codemirror/state';

// Singleton compartments to ensure identity persistence across component re-mounts.
// This allows restored EditorStates (which hold the old Compartment config)
// to be correctly reconfigured with new values.
export const themeCompartment = new Compartment();
export const listenerCompartment = new Compartment();

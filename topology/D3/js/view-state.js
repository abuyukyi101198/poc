const DEFAULT_FILTERS = Object.freeze({
  unresolved: false,
  routingCapable: false,
  bonded: false,
  managementVlan: false,
  evidenceMarkers: false,
});

export function createViewState(onChange) {
  let state = {
    query: '',
    selection: null,
    filters: { ...DEFAULT_FILTERS },
    selectedGroupId: null,
    maasLens: 'none',
  };

  const notify = () => onChange?.(state);
  return {
    get: () => state,
    update(patch) {
      state = {
        ...state,
        ...patch,
        filters: { ...state.filters, ...(patch.filters || {}) },
      };
      notify();
    },
    selectNode(id) {
      this.update({ selection: id ? { type: 'node', id } : null });
    },
    selectLink(id) {
      this.update({ selection: id ? { type: 'link', id } : null });
    },
    clearSelection() {
      this.update({ selection: null });
    },
    reset() {
      state = {
        query: '',
        selection: null,
        filters: { ...DEFAULT_FILTERS },
        selectedGroupId: null,
        maasLens: 'none',
      };
      notify();
    },
  };
}

export { DEFAULT_FILTERS };

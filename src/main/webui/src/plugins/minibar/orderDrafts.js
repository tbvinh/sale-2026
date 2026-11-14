const STORAGE_KEY = 'minibar_table_drafts';

export function getAllDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function getTableDraft(tableId) {
  if (!tableId) return null;
  const all = getAllDrafts();
  return all[tableId] || null;
}

export function saveTableDraft(tableId, draft) {
  if (!tableId) return;
  const all = getAllDrafts();
  all[tableId] = {
    ...draft,
    tableId,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearTableDraft(tableId) {
  if (!tableId) return;
  const all = getAllDrafts();
  delete all[tableId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function transferTableDraft(fromTableId, toTableId) {
  if (!fromTableId || !toTableId) return;
  const all = getAllDrafts();
  if (all[fromTableId]) {
    all[toTableId] = {
      ...all[fromTableId],
      tableId: toTableId,
      transferredFrom: fromTableId,
      updatedAt: new Date().toISOString(),
    };
    delete all[fromTableId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}


import { http } from '../../core/http.js';
import { diningTablesStore, USE_REAL_API } from '../../core/masterdata.js';

export async function renameDiningArea(oldName, newName, currentTables = []) {
  const trimmedNew = (newName || '').trim();
  const trimmedOld = (oldName || '').trim();
  if (!trimmedOld || !trimmedNew) return;

  if (USE_REAL_API) {
    try {
      await http.post('/dining-tables/areas/rename', { oldName: trimmedOld, newName: trimmedNew });
      await diningTablesStore.reload();
      return;
    } catch (err) {
      console.warn('Backend renameArea failed, falling back to client update:', err);
    }
  }

  // Client-side fallback or mock mode
  const matching = (currentTables || []).filter((t) => (t.area || '').trim() === trimmedOld);
  for (const t of matching) {
    await diningTablesStore.update(t.id, { area: trimmedNew });
  }
}

export async function deleteDiningArea(areaName, targetArea = 'Khu vực chung', currentTables = []) {
  const trimmedArea = (areaName || '').trim();
  const trimmedTarget = (targetArea || 'Khu vực chung').trim();
  if (!trimmedArea) return;

  if (USE_REAL_API) {
    try {
      await http.post('/dining-tables/areas/delete', { areaName: trimmedArea, targetArea: trimmedTarget });
      await diningTablesStore.reload();
      return;
    } catch (err) {
      console.warn('Backend deleteArea failed, falling back to client update:', err);
    }
  }

  // Client-side fallback or mock mode
  const matching = (currentTables || []).filter((t) => (t.area || '').trim() === trimmedArea);
  for (const t of matching) {
    await diningTablesStore.update(t.id, { area: trimmedTarget });
  }
}


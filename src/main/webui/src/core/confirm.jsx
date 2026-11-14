import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { addMessages, useI18n } from './i18n.jsx';

addMessages({
  vi: { 'confirm.yes': 'Đồng ý', 'confirm.no': 'Hủy', 'confirm.title': 'Xác nhận' },
  en: { 'confirm.yes': 'Yes', 'confirm.no': 'No', 'confirm.title': 'Confirm' },
});

const Ctx = createContext();

// confirm(message) trả về Promise<boolean> — dùng: if (await confirm('Xóa?')) { ...xóa... }
export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const confirm = useCallback((message) => new Promise((resolve) => setReq({ message, resolve })), []);
  const answer = (v) => { req.resolve(v); setReq(null); };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      {req && <ConfirmDialog message={req.message} onYes={() => answer(true)} onNo={() => answer(false)} />}
    </Ctx.Provider>
  );
}
export const useConfirm = () => useContext(Ctx);

function ConfirmDialog({ message, onYes, onNo }) {
  const { t } = useI18n();
  const target = document.fullscreenElement || document.body;
  const content = (
    <div
      className="confirm-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 10000000,
      }}
      onMouseDown={onNo}
    >
      <div
        className="confirm-box"
        role="alertdialog"
        aria-modal="true"
        style={{
          width: '400px',
          maxWidth: '92vw',
          background: '#fff',
          borderRadius: '10px',
          padding: '22px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>{t('confirm.title')}</h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.5', color: '#334155', whiteSpace: 'pre-line' }}>{message}</p>
        <div className="confirm-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button type="button" className="tb" onClick={onNo} style={{ padding: '7px 16px', fontSize: '13.5px', borderRadius: '6px' }}>{t('confirm.no')}</button>
          <button type="button" className="btn danger" onClick={onYes} autoFocus style={{ padding: '7px 18px', fontSize: '13.5px', borderRadius: '6px' }}>{t('confirm.yes')}</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, target);
}

import React, { useState } from 'react';
import { usePlugins, bus } from './plugins.js';
import { useAuth } from './auth.jsx';
import { useI18n } from './i18n.jsx';
import { usePermissions } from './permissions.js';
import { useTenant, useCompanies, setCompanies, setActiveCompany } from './tenant.js'; // tenant store
import { apiFetch } from './api.js';
import { resetAllStores } from './masterdata.js';
import GlobalSearch from './GlobalSearch.jsx';
import StatusBar from './StatusBar.jsx';
import Ribbon, { commonTabs, buildTabs } from './ribbon.jsx';
import { useHistoryState } from './router.js';

const SIDE_MIN = 200;
const SIDE_MAX = 450;
const clampSide = (w) => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)));
const readSideWidth = () => {
  const saved = Number(localStorage.getItem('sideWidth'));
  return Number.isFinite(saved) && saved > 0 ? clampSide(saved) : 230;
};

export default function Shell() {
  const allPlugins = usePlugins();
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const perms = usePermissions();
  const companyId = useTenant();
  const companies = useCompanies();
  const [tenantRev, setTenantRev] = React.useState(0);

  React.useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    apiFetch('/api/companies', { silent401: true })
      .then((list) => {
        if (!alive) return;
        const arr = list ?? [];
        setCompanies(arr);
        const canUsePublic = user.role === 'admin' || user.allowPublic !== false;
        if (!canUsePublic && arr.length > 0) {
          const cur = companyId;
          const valid = cur && arr.some((c) => String(c.id) === String(cur));
          if (!valid) {
            const defCo = arr.find((c) => String(c.id) === String(user.defaultCompanyId)) ?? arr[0];
            if (defCo) setActiveCompany(String(defCo.id));
          }
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.username]);

  const firstTenant = React.useRef(true);
  React.useEffect(() => {
    if (firstTenant.current) { firstTenant.current = false; return; }
    resetAllStores();
    setQuery('');
    setNav((n) => ({ ...n, found: '', store: {} }), { replace: true });
    setTenantRev((v) => v + 1);
  }, [companyId]);

  const switchCompany = (id) => setActiveCompany(id);

  const role = user.role;
  const isCompanyOwner = user.roleCode === 'company_admin' || (Array.isArray(user.ownerCompanyIds) && user.ownerCompanyIds.length > 0);
  const can = (pluginId, action) => role === 'admin' || (pluginId === 'admin' && isCompanyOwner) || !!perms[pluginId]?.[action];
  const plugins = allPlugins.filter((p) => !p.adminOnly || role === 'admin' || isCompanyOwner);

  // Điều hướng (plugin đang mở / state của nó / từ khóa tìm kiếm) được lưu
  // trong location.hash -> nút Back/Forward của trình duyệt dùng được.
  const [nav, setNav] = useHistoryState({ pluginId: plugins[0]?.id, found: '', store: {} });
  const { pluginId: activeId, found, store } = nav;
  const setActiveId = (id) => setNav((n) => ({ ...n, pluginId: id, found: '' }));

  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState(found);            // chữ đang gõ trong ô tìm kiếm
  const [navOpen, setNavOpen] = useState(() => localStorage.getItem('navOpen') !== '0');
  const toggleNav = () => { localStorage.setItem('navOpen', navOpen ? '0' : '1'); setNavOpen(!navOpen); };
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = React.useRef(null);

  React.useEffect(() => {
    if (!userOpen) return undefined;
    const onDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setUserOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [userOpen]);

  // Độ rộng ngăn điều hướng: kéo vạch chia, lưu lại trong localStorage
  const [sideWidth, setSideWidth] = useState(readSideWidth);
  const sideRef = React.useRef(null);
  React.useEffect(() => { localStorage.setItem('sideWidth', String(sideWidth)); }, [sideWidth]);

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideRef.current?.getBoundingClientRect().width ?? sideWidth;
    document.body.classList.add('resizing');
    const move = (ev) => {
      if (sideRef.current) sideRef.current.style.width = clampSide(startW + ev.clientX - startX) + 'px';
    };
    const stop = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
      document.body.classList.remove('resizing');
      if (sideRef.current) setSideWidth(clampSide(sideRef.current.getBoundingClientRect().width));
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
  };

  React.useEffect(() => { setQuery(found); }, [found]);

  React.useEffect(() => {
    return bus.on('navigate', ({ pluginId, state }) => {
      if (!pluginId) return;
      setQuery('');
      setNav((n) => ({
        ...n,
        pluginId,
        found: '',
        store: state ? { ...n.store, [pluginId]: { ...(n.store[pluginId] ?? {}), ...state } } : n.store,
      }));
      setTab('home');
    });
  }, []);

  const active = plugins.find((p) => p.id === activeId) ?? plugins[0];
  if (!active) return <p style={{ padding: 24 }}>No plugins.</p>;

  const initial = active.initialState ?? {};
  const props = {
    bus, role, can,
    state: store[active.id] ?? initial,
    // opts.replace:true (gõ chữ, kéo…) cập nhật trang hiện tại; mặc định tạo entry mới cho Back/Forward
    setState: (patch, opts) =>
      setNav((n) => ({ ...n, store: { ...n.store, [active.id]: { ...(n.store[active.id] ?? initial), ...patch } } }), opts),
  };

  const closeSearch = () => { setQuery(''); setNav((n) => ({ ...n, found: '' })); };
  const openResult = (p, r) => {           // mở kết quả: chuyển plugin + áp state của kết quả
    setQuery('');
    setNav((n) => ({ ...n, pluginId: p.id, found: '', store: { ...n.store, [p.id]: { ...(n.store[p.id] ?? p.initialState ?? {}), ...r.state } } }));
    setTab('home');
  };

  // Nút Refresh chung: plugin tự định nghĩa refresh(), mặc định tăng state.reload
  const refresh = () => active.refresh
    ? active.refresh(props)
    : props.setState({ reload: (props.state.reload ?? 0) + 1 }, { replace: true });
  const tabs = buildTabs(commonTabs({ logout, refresh, lang, setLang, navOpen, toggleNav }), active.ribbon?.({ ...props, t }));
  const username = user.username || '?';
  const fullName = user.name && user.name !== username ? user.name : username;
  const display = user.name && user.name !== username ? `${user.name} (${username})` : username;
  const roleLabel = user.roleName || t('role.' + role);
  return (
    <div className="app">
      <header className="topbar">
        <div className="navbtns">
          <button onClick={() => history.back()} title={t('nav.back')}>◀</button>
          <button onClick={() => history.forward()} title={t('nav.forward')}>▶</button>
        </div>
        <button className="navtoggle" onClick={toggleNav} aria-expanded={navOpen} title={t('ribbon.navpane')}>☰</button>
        <b>{t('app.name')}</b>
        <form onSubmit={(e) => { e.preventDefault(); setNav((n) => ({ ...n, found: query.trim() })); }}>
          <div className="searchbox">
            <span aria-hidden="true">🔍</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search.placeholder')}
              aria-label={t('search.placeholder')}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()} />
            {query && <button type="button" className="xbtn" title={t('search.clear')}
              aria-label={t('search.clear')} onClick={closeSearch}>✕</button>}
          </div>
        </form>
        <select className="companysel" value={companyId} title={t('company.label')} aria-label={t('company.label')}
          onChange={(e) => switchCompany(e.target.value)}>
          {(role === 'admin' || user.allowPublic !== false) && (
            <option value="">{t('company.default')}</option>
          )}
          {companies.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <span className="rolebadge">{roleLabel}</span>
        <div className="userwrap" ref={userMenuRef}>
          <button type="button" className="userchip" onClick={() => setUserOpen((v) => !v)}
            aria-haspopup="menu" aria-expanded={userOpen} title={display}>
            <span className="avatar">
              {user.imageUrl ? <img src={user.imageUrl} alt={username} /> : display[0].toUpperCase()}
            </span>
            <span className="username">{username}</span>
            <span className="usercaret" aria-hidden="true">▾</span>
          </button>
          {userOpen && (
            <div className="usermenu" role="menu">
              <div className="userhead">
                <span className="avatar lg">
                  {user.imageUrl ? <img src={user.imageUrl} alt={username} /> : display[0].toUpperCase()}
                </span>
                <div className="userinfo">
                  <b>{fullName}</b>
                  <small>@{username}</small>
                  <span className="usermenu-role">{roleLabel}</span>
                </div>
              </div>
              <div className="usermenu-sep" />
              <button type="button" className="usermenu-item danger" role="menuitem"
                onClick={() => { setUserOpen(false); logout(); }}>
                <span>🚪</span>
                <span>{t('logout')}</span>
              </button>
            </div>
          )}
        </div>
      </header>
      <Ribbon tabs={tabs} tab={tab} setTab={setTab} />
      <div className="body">
        <nav className="rail">
          {plugins.map((p) => (
            <button key={p.id} className={p.id === active.id ? 'on' : ''} onClick={() => setActiveId(p.id)}>
              <span className="ico">{p.icon}{p.Badge && <p.Badge />}</span>
              <small>{t(p.title)}</small>
            </button>
          ))}
        </nav>
        {found ? (
          <main className="main"><GlobalSearch query={found} plugins={plugins} can={can} onOpen={openResult} onClose={closeSearch} /></main>
        ) : (<>
          {active.Menu && navOpen && (
            <div className="sidewrap" ref={sideRef} style={{ width: sideWidth }}>
              <aside className="side"><active.Menu key={active.id + ':' + tenantRev} {...props} /></aside>
              <div className="side-resizer" role="separator" aria-orientation="vertical"
                aria-label={t('ribbon.navpane')} title={t('ribbon.navpane')}
                onMouseDown={startResize} />
            </div>
          )}
          <main className="main"><active.View key={active.id + ':' + tenantRev} {...props} /></main>
        </>)}
      </div>
      <StatusBar />
    </div>
  );
}

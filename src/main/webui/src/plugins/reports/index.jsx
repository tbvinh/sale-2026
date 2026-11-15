import { useMemo, useState } from 'react';
import { useI18n } from '../../core/i18n.jsx';
import { useAuth } from '../../core/auth.jsx';
import Denied from '../../core/Denied.jsx';
import { useDebounced } from '../../core/useDebounced.js';
import { useAsyncQuery } from '../../core/useasyncquery.js';
import { http } from '../../core/http.js';
import { vnd, formatDate } from '../../core/masterdata.js';

const toQS = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) p.set(k, v);
  });
  const qs = p.toString();
  return qs ? `?${qs}` : '';
};

const ownerReportApi = {
  analytics: (params, opts) => http.get('/reports/owner/analytics' + toQS(params), opts),
};

const nowDate = () => new Date();
const curYear = () => nowDate().getFullYear();
const curMonth = () => nowDate().getMonth() + 1;
const curQuarter = () => Math.floor((curMonth() - 1) / 3) + 1;
const qtyText = (n) => (n == null ? '0' : Number(n).toLocaleString('vi-VN'));

const COMPANY_COLORS = [
  '#2563eb', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#84cc16', // Lime
];

const REPORT_MENU = [
  { id: 'overview', icon: '📊', title: 'reports.menuOverview' },
  { id: 'company-chart', icon: '🏢', title: 'reports.menuCompanyChart' },
  { id: 'customer-stats', icon: '👥', title: 'reports.menuCustomerStats' },
];

const messages = {
  vi: {
    'reports.title': 'Báo cáo',
    'reports.ownerBadge': 'Dành riêng cho Chủ sở hữu (Owner)',
    'reports.menuOverview': 'Tổng quan Doanh số & Khách hàng',
    'reports.menuCompanyChart': 'Biểu đồ doanh số từng công ty',
    'reports.menuCustomerStats': 'Thống kê khách hàng mua hàng',
    'reports.periodType': 'Kỳ thống kê',
    'reports.byMonth': 'Theo Tháng',
    'reports.byQuarter': 'Theo Quý',
    'reports.byYear': 'Theo Năm',
    'reports.year': 'Năm',
    'reports.quarter': 'Quý',
    'reports.month': 'Tháng',
    'reports.company': 'Công ty',
    'reports.allCompanies': 'Tất cả công ty sở hữu',
    'reports.searchCustomer': 'Tìm tên hoặc mã khách hàng…',
    'reports.refresh': 'Làm mới',
    'reports.totalRevenue': 'Tổng doanh số trong kỳ',
    'reports.totalOrders': 'Tổng số đơn bán',
    'reports.totalCustomers': 'Khách hàng mua hàng',
    'reports.totalCompanies': 'Số công ty sở hữu',
    'reports.companySalesChartTitle': 'Biểu đồ doanh số từng công ty',
    'reports.companyShareTitle': 'Tỷ trọng doanh số giữa các công ty trong kỳ',
    'reports.customerTopChartTitle': 'Top khách hàng mua hàng cao nhất trong kỳ',
    'reports.customerTableTitle': 'Bảng thống kê chi tiết khách hàng mua hàng',
    'reports.rank': 'Hạng',
    'reports.customerName': 'Khách hàng',
    'reports.orderCount': 'Số đơn mua',
    'reports.totalQty': 'Tổng SL mua',
    'reports.revenue': 'Doanh số mua',
    'reports.avgOrder': 'TB / Đơn',
    'reports.sharePct': 'Tỷ trọng',
    'reports.lastPurchase': 'Mua gần nhất',
    'reports.q1': 'Quý 1',
    'reports.q2': 'Quý 2',
    'reports.q3': 'Quý 3',
    'reports.q4': 'Quý 4',
    'reports.emptyCustomer': 'Chưa có dữ liệu khách hàng mua hàng trong kỳ đã chọn.',
    'reports.emptyCompany': 'Chưa có dữ liệu doanh số công ty trong kỳ đã chọn.',
    'reports.onlyOwner': 'Báo cáo này chỉ dành cho tài khoản Chủ sở hữu công ty (Owner).',
    'reports.chartTypeBar': 'Biểu đồ Cột',
    'reports.chartTypeHorizontal': 'So sánh Ngang',
  },
  en: {
    'reports.title': 'Reports',
    'reports.ownerBadge': 'Owner Exclusive Analytics',
    'reports.menuOverview': 'Sales & Customer Overview',
    'reports.menuCompanyChart': 'Company Sales Chart',
    'reports.menuCustomerStats': 'Customer Purchase Statistics',
    'reports.periodType': 'Period Type',
    'reports.byMonth': 'Monthly',
    'reports.byQuarter': 'Quarterly',
    'reports.byYear': 'Yearly',
    'reports.year': 'Year',
    'reports.quarter': 'Quarter',
    'reports.month': 'Month',
    'reports.company': 'Company',
    'reports.allCompanies': 'All Owned Companies',
    'reports.searchCustomer': 'Search customer name or code…',
    'reports.refresh': 'Refresh',
    'reports.totalRevenue': 'Period Total Revenue',
    'reports.totalOrders': 'Total Sales Orders',
    'reports.totalCustomers': 'Active Customers',
    'reports.totalCompanies': 'Owned Companies',
    'reports.companySalesChartTitle': 'Sales Chart by Company',
    'reports.companyShareTitle': 'Revenue Share by Company in Period',
    'reports.customerTopChartTitle': 'Top Purchasing Customers in Period',
    'reports.customerTableTitle': 'Customer Purchase Statistics Table',
    'reports.rank': 'Rank',
    'reports.customerName': 'Customer',
    'reports.orderCount': 'Orders',
    'reports.totalQty': 'Total Qty',
    'reports.revenue': 'Total Spend',
    'reports.avgOrder': 'Avg / Order',
    'reports.sharePct': 'Share %',
    'reports.lastPurchase': 'Last Purchase',
    'reports.q1': 'Q1',
    'reports.q2': 'Q2',
    'reports.q3': 'Q3',
    'reports.q4': 'Q4',
    'reports.emptyCustomer': 'No customer purchase records found in the selected period.',
    'reports.emptyCompany': 'No company sales data found in the selected period.',
    'reports.onlyOwner': 'This report is exclusively visible to Company Owners.',
    'reports.chartTypeBar': 'Column Chart',
    'reports.chartTypeHorizontal': 'Horizontal Comparison',
  },
};

function isOwnerUser(user) {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.roleCode === 'company_admin' ||
    (Array.isArray(user.ownerCompanyIds) && user.ownerCompanyIds.length > 0)
  );
}

function Menu({ state, setState }) {
  const { t } = useI18n();
  const currentTab = state.tab || 'overview';
  return (
    <>
      <h3>📊 {t('reports.title')}</h3>
      <div
        style={{
          margin: '0 0 10px',
          padding: '6px 10px',
          borderRadius: 6,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        👑 {t('reports.ownerBadge')}
      </div>
      {REPORT_MENU.map((m) => (
        <button
          key={m.id}
          type="button"
          className={'item' + (currentTab === m.id ? ' on' : '')}
          onClick={() => setState({ tab: m.id })}
        >
          <span>
            {m.icon} {t(m.title)}
          </span>
        </button>
      ))}
    </>
  );
}

/* ---------- Biểu đồ Doanh số từng công ty theo Tháng / Quý / Năm (SVG + Interactive Bars) ---------- */
function CompanySalesChartSection({ companySalesChart = [], periodLabels = [], periodType, year, quarter, month, t }) {
  const [chartMode, setChartMode] = useState('grouped'); // grouped | horizontal

  const maxBucketValue = useMemo(() => {
    let max = 0;
    companySalesChart.forEach((co) => {
      (co.series || []).forEach((pt) => {
        const val = Number(pt.revenue) || 0;
        if (val > max) max = val;
      });
    });
    return max > 0 ? max : 1;
  }, [companySalesChart]);

  const totalPeriodRevAll = useMemo(
    () => companySalesChart.reduce((s, c) => s + (Number(c.periodRevenue) || 0), 0),
    [companySalesChart]
  );

  const periodTitleSuffix =
    periodType === 'month'
      ? `(${t('reports.month')} ${month}/${year} & xu hướng 12 tháng năm ${year})`
      : periodType === 'quarter'
      ? `(${t('reports.quarter')} ${quarter}/${year} & 4 quý năm ${year})`
      : `(5 năm gần nhất đến ${year})`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
      {/* Card 1: Biểu đồ doanh số theo thời gian của từng công ty */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📈 {t('reports.companySalesChartTitle')}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>{periodTitleSuffix}</span>
            </h3>
          </div>

          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setChartMode('grouped')}
              style={{
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                border: 'none',
                background: chartMode === 'grouped' ? '#0f6cbd' : '#fff',
                color: chartMode === 'grouped' ? '#fff' : '#334155',
                cursor: 'pointer',
              }}
            >
              📊 {t('reports.chartTypeBar')}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('horizontal')}
              style={{
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                border: 'none',
                borderLeft: '1px solid #cbd5e1',
                background: chartMode === 'horizontal' ? '#0f6cbd' : '#fff',
                color: chartMode === 'horizontal' ? '#fff' : '#334155',
                cursor: 'pointer',
              }}
            >
              🏢 {t('reports.chartTypeHorizontal')}
            </button>
          </div>
        </div>

        {/* Chú thích (Legend) các công ty */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          {companySalesChart.map((co, idx) => {
            const color = COMPANY_COLORS[idx % COMPANY_COLORS.length];
            return (
              <div
                key={co.companyId}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 12.5,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: color,
                    display: 'inline-block',
                  }}
                />
                <strong style={{ color: '#1e293b' }}>{co.companyName}</strong>
                <span style={{ color: '#64748b' }}>({vnd(co.periodRevenue)})</span>
              </div>
            );
          })}
        </div>

        {companySalesChart.length === 0 ? (
          <div className="empty" style={{ textAlign: 'center', padding: 32 }}>
            {t('reports.emptyCompany')}
          </div>
        ) : chartMode === 'grouped' ? (
          /* Biểu đồ cột nhóm theo Tháng / Quý / Năm */
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div
              style={{
                minWidth: Math.max(580, periodLabels.length * 68),
                height: 270,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                borderBottom: '2px solid #cbd5e1',
                borderLeft: '1px solid #e2e8f0',
                padding: '24px 12px 0 12px',
                position: 'relative',
                background:
                  'repeating-linear-gradient(to top, transparent 0, transparent 48px, #f1f5f9 48px, #f1f5f9 49px)',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${periodLabels.length}, minmax(48px, 1fr))`,
                  gap: 10,
                  alignItems: 'end',
                  height: '100%',
                }}
              >
                {periodLabels.map((label, bIdx) => {
                  const isActiveBucket =
                    (periodType === 'month' && bIdx + 1 === Number(month)) ||
                    (periodType === 'quarter' && bIdx + 1 === Number(quarter)) ||
                    (periodType === 'year' && label.endsWith(String(year)));

                  return (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%',
                        padding: '0 4px',
                        borderRadius: '6px 6px 0 0',
                        background: isActiveBucket ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          gap: 3,
                          width: '100%',
                          height: '210px',
                        }}
                      >
                        {companySalesChart.map((co, cIdx) => {
                          const color = COMPANY_COLORS[cIdx % COMPANY_COLORS.length];
                          const rev = Number(co.series?.[bIdx]?.revenue) || 0;
                          const orders = Number(co.series?.[bIdx]?.orderCount) || 0;
                          const pct = rev > 0 ? Math.max(4, Math.round((rev / maxBucketValue) * 100)) : 0;

                          return (
                            <div
                              key={co.companyId}
                              title={`${co.companyName} - ${label}: ${vnd(rev)} (${orders} đơn)`}
                              style={{
                                flex: 1,
                                maxWidth: 26,
                                height: `${pct}%`,
                                minHeight: rev > 0 ? 4 : 1,
                                background: rev > 0 ? color : '#e2e8f0',
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.25s ease',
                                position: 'relative',
                                cursor: 'pointer',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Nhãn trục X */}
            <div
              style={{
                minWidth: Math.max(580, periodLabels.length * 68),
                display: 'grid',
                gridTemplateColumns: `repeat(${periodLabels.length}, minmax(48px, 1fr))`,
                gap: 10,
                padding: '8px 12px 0 12px',
              }}
            >
              {periodLabels.map((label, bIdx) => {
                const isActiveBucket =
                  (periodType === 'month' && bIdx + 1 === Number(month)) ||
                  (periodType === 'quarter' && bIdx + 1 === Number(quarter)) ||
                  (periodType === 'year' && label.endsWith(String(year)));
                const bucketSum = companySalesChart.reduce(
                  (s, co) => s + (Number(co.series?.[bIdx]?.revenue) || 0),
                  0
                );
                return (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isActiveBucket ? 800 : 600,
                        color: isActiveBucket ? '#1d4ed8' : '#475569',
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {bucketSum > 0 ? vnd(bucketSum) : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* So sánh ngang doanh số giữa các công ty */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {companySalesChart.map((co, idx) => {
              const color = COMPANY_COLORS[idx % COMPANY_COLORS.length];
              const rev = Number(co.periodRevenue) || 0;
              const share = totalPeriodRevAll > 0 ? Math.round((rev / totalPeriodRevAll) * 1000) / 10 : 0;
              return (
                <div
                  key={co.companyId}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                    <div>
                      <strong style={{ color: '#0f172a' }}>
                        [{co.companyCode}] {co.companyName}
                      </strong>
                      <span style={{ color: '#64748b', marginLeft: 10, fontSize: 12 }}>
                        ({co.periodOrders} đơn · {co.periodCustomers} khách hàng)
                      </span>
                    </div>
                    <div>
                      <strong style={{ color }}>{vnd(rev)}</strong>
                      <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>({share}%)</span>
                    </div>
                  </div>
                  <div style={{ height: 12, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(rev > 0 ? 2 : 0, share)}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 999,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 2: Bảng tổng hợp doanh số từng công ty */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#0f172a' }}>
          🏢 {t('reports.companyShareTitle')}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="invtable zebra">
            <thead>
              <tr>
                <th>{t('reports.company')}</th>
                <th className="num">{t('reports.orderCount')}</th>
                <th className="num">{t('reports.totalCustomers')}</th>
                <th className="num">{t('reports.totalQty')}</th>
                <th className="num">{t('reports.revenue')}</th>
                <th className="num">{t('reports.sharePct')}</th>
              </tr>
            </thead>
            <tbody>
              {companySalesChart.map((co, idx) => {
                const color = COMPANY_COLORS[idx % COMPANY_COLORS.length];
                const rev = Number(co.periodRevenue) || 0;
                const share = totalPeriodRevAll > 0 ? ((rev * 100) / totalPeriodRevAll).toFixed(1) : '0.0';
                return (
                  <tr key={co.companyId}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: color,
                          marginRight: 8,
                        }}
                      />
                      <b>
                        {co.companyCode} - {co.companyName}
                      </b>
                    </td>
                    <td className="num">{qtyText(co.periodOrders)}</td>
                    <td className="num">{qtyText(co.periodCustomers)}</td>
                    <td className="num">{qtyText(co.periodQty)}</td>
                    <td className="num">
                      <b style={{ color: '#0f172a' }}>{vnd(rev)}</b>
                    </td>
                    <td className="num">{share}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  <b>Tổng cộng ({companySalesChart.length} công ty)</b>
                </td>
                <td className="num">
                  <b>{qtyText(companySalesChart.reduce((s, c) => s + (Number(c.periodOrders) || 0), 0))}</b>
                </td>
                <td className="num">
                  <b>{qtyText(companySalesChart.reduce((s, c) => s + (Number(c.periodCustomers) || 0), 0))}</b>
                </td>
                <td className="num">
                  <b>{qtyText(companySalesChart.reduce((s, c) => s + (Number(c.periodQty) || 0), 0))}</b>
                </td>
                <td className="num">
                  <b style={{ color: '#0f6cbd' }}>{vnd(totalPeriodRevAll)}</b>
                </td>
                <td className="num">
                  <b>100%</b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Thống kê khách hàng mua hàng theo Tháng / Quý / Năm ---------- */
function CustomerPurchaseSection({ customerStats = [], totals = {}, periodType, year, t }) {
  const topCustomers = customerStats.slice(0, 8);
  const maxCustRev = useMemo(() => {
    const m = topCustomers.reduce((max, c) => Math.max(max, Number(c.totalRevenue) || 0), 0);
    return m > 0 ? m : 1;
  }, [topCustomers]);

  const showQuarterlyBreakdown = periodType === 'year' || periodType === 'quarter';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Biểu đồ Top khách hàng mua nhiều nhất */}
      {topCustomers.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h3 style={{ margin: '0 0 14px 0', fontSize: 15, color: '#0f172a' }}>
            🏆 {t('reports.customerTopChartTitle')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topCustomers.map((c, idx) => {
              const rev = Number(c.totalRevenue) || 0;
              const widthPct = Math.max(4, Math.round((rev / maxCustRev) * 100));
              return (
                <div key={`${c.companyId}-${c.customerId}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: idx < 3 ? '#dbeafe' : '#f1f5f9',
                      color: idx < 3 ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: 12,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ width: 220, minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    <b title={c.customerName}>{c.customerName}</b>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.companyName}</div>
                  </div>
                  <div style={{ flex: 1, background: '#f1f5f9', height: 14, borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: idx === 0 ? '#2563eb' : idx === 1 ? '#0284c7' : idx === 2 ? '#0d9488' : '#64748b',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div style={{ width: 130, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {vnd(rev)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bảng chi tiết khách hàng mua hàng */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#0f172a' }}>
            👥 {t('reports.customerTableTitle')} ({customerStats.length})
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="invtable zebra">
            <thead>
              <tr>
                <th style={{ width: 50 }}>{t('reports.rank')}</th>
                <th>{t('reports.customerName')}</th>
                <th>{t('reports.company')}</th>
                <th className="num">{t('reports.orderCount')}</th>
                <th className="num">{t('reports.totalQty')}</th>
                {showQuarterlyBreakdown && (
                  <>
                    <th className="num">{t('reports.q1')} ({year})</th>
                    <th className="num">{t('reports.q2')} ({year})</th>
                    <th className="num">{t('reports.q3')} ({year})</th>
                    <th className="num">{t('reports.q4')} ({year})</th>
                  </>
                )}
                <th className="num">{t('reports.revenue')}</th>
                <th className="num">{t('reports.avgOrder')}</th>
                <th className="num">{t('reports.sharePct')}</th>
                <th>{t('reports.lastPurchase')}</th>
              </tr>
            </thead>
            <tbody>
              {customerStats.map((r, i) => (
                <tr key={`${r.companyId}-${r.customerId}-${i}`}>
                  <td>
                    <b>#{r.rank}</b>
                  </td>
                  <td>
                    <b>{r.customerName}</b>
                    {r.customerId && r.customerId !== 'khach-vang-lai' && (
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>Mã: {r.customerId}</div>
                    )}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f1f5f9',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {r.companyName}
                    </span>
                  </td>
                  <td className="num">{qtyText(r.orderCount)}</td>
                  <td className="num">{qtyText(r.totalQty)}</td>
                  {showQuarterlyBreakdown && (
                    <>
                      <td className="num">{vnd(r.quarters?.Q1 || 0)}</td>
                      <td className="num">{vnd(r.quarters?.Q2 || 0)}</td>
                      <td className="num">{vnd(r.quarters?.Q3 || 0)}</td>
                      <td className="num">{vnd(r.quarters?.Q4 || 0)}</td>
                    </>
                  )}
                  <td className="num">
                    <b style={{ color: '#0f6cbd' }}>{vnd(r.totalRevenue)}</b>
                  </td>
                  <td className="num">{vnd(r.avgOrderValue)}</td>
                  <td className="num">{r.sharePercent?.toFixed(1)}%</td>
                  <td>{r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : ''}</td>
                </tr>
              ))}
              {customerStats.length === 0 && (
                <tr>
                  <td colSpan={showQuarterlyBreakdown ? 14 : 10} className="empty" style={{ textAlign: 'center', padding: 28 }}>
                    {t('reports.emptyCustomer')}
                  </td>
                </tr>
              )}
            </tbody>
            {customerStats.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <b>Tổng cộng ({customerStats.length} khách hàng)</b>
                  </td>
                  <td className="num">
                    <b>{qtyText(totals.orders)}</b>
                  </td>
                  <td className="num">
                    <b>{qtyText(totals.qty)}</b>
                  </td>
                  {showQuarterlyBreakdown && (
                    <>
                      <td className="num">
                        <b>{vnd(customerStats.reduce((s, r) => s + (Number(r.quarters?.Q1) || 0), 0))}</b>
                      </td>
                      <td className="num">
                        <b>{vnd(customerStats.reduce((s, r) => s + (Number(r.quarters?.Q2) || 0), 0))}</b>
                      </td>
                      <td className="num">
                        <b>{vnd(customerStats.reduce((s, r) => s + (Number(r.quarters?.Q3) || 0), 0))}</b>
                      </td>
                      <td className="num">
                        <b>{vnd(customerStats.reduce((s, r) => s + (Number(r.quarters?.Q4) || 0), 0))}</b>
                      </td>
                    </>
                  )}
                  <td className="num">
                    <b style={{ color: '#0f6cbd' }}>{vnd(totals.revenue)}</b>
                  </td>
                  <td className="num">
                    <b>{vnd(totals.orders > 0 ? Math.round(Number(totals.revenue) / Number(totals.orders)) : 0)}</b>
                  </td>
                  <td className="num">
                    <b>100%</b>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function OwnerAnalyticsDashboard({ state, setState }) {
  const { t } = useI18n();
  const set = (patch) => setState(patch, { replace: true });

  const tab = state.tab || 'overview';
  const periodType = state.periodType || 'month';
  const year = state.year ?? curYear();
  const quarter = state.quarter ?? curQuarter();
  const month = state.month ?? curMonth();
  const companyId = state.companyId ?? 'all';
  const q = state.q ?? '';
  const settledQ = useDebounced(q, 300);

  const queryParams = useMemo(
    () => ({
      periodType,
      year,
      quarter,
      month,
      companyId,
      q: settledQ,
    }),
    [periodType, year, quarter, month, companyId, settledQ]
  );

  const { data, fetching, error, reload } = useAsyncQuery(
    'owner-reports:' + JSON.stringify(queryParams) + ':' + (state.refresh ?? 0),
    (signal) => ownerReportApi.analytics(queryParams, { signal }),
    { enabled: q === settledQ }
  );

  const companies = data?.companies ?? [];
  const companySalesChart = data?.companySalesChart ?? [];
  const customerStats = data?.customerStats ?? [];
  const periodLabels = data?.periodLabels ?? [];
  const totals = data?.totals ?? {};

  const yearsList = useMemo(() => {
    const cy = curYear();
    const arr = [];
    for (let y = cy + 1; y >= cy - 6; y--) arr.push(y);
    return arr;
  }, []);

  return (
    <div className="pad">
      {/* Header */}
      <div className="ghead" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>
              {tab === 'company-chart'
                ? '🏢 ' + t('reports.menuCompanyChart')
                : tab === 'customer-stats'
                ? '👥 ' + t('reports.menuCustomerStats')
                : '📊 ' + t('reports.menuOverview')}
            </h2>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              👑 {t('reports.ownerBadge')}
            </span>
          </div>
          {data?.dateFrom && data?.dateTo && (
            <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
              Kỳ dữ liệu: <b>{formatDate(data.dateFrom)}</b> → <b>{formatDate(data.dateTo)}</b>
            </p>
          )}
        </div>
        <button type="button" className="tb" onClick={reload} disabled={fetching}>
          ⟳ {t('reports.refresh')}
        </button>
      </div>

      {/* Bộ lọc Tháng / Quý / Năm + Công ty + Tìm khách hàng */}
      <div
        className="cattools"
        style={{
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        {/* Chọn loại kỳ: Tháng / Quý / Năm */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{t('reports.periodType')}</span>
          <div style={{ display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
            {[
              { id: 'month', label: t('reports.byMonth') },
              { id: 'quarter', label: t('reports.byQuarter') },
              { id: 'year', label: t('reports.byYear') },
            ].map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => set({ periodType: pt.id })}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRight: pt.id !== 'year' ? '1px solid #cbd5e1' : 'none',
                  background: periodType === pt.id ? '#0f6cbd' : '#fff',
                  color: periodType === pt.id ? '#fff' : '#334155',
                  cursor: 'pointer',
                }}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chọn Năm */}
        <label className="filter" style={{ margin: 0 }}>
          <span>{t('reports.year')}</span>
          <select value={year} onChange={(e) => set({ year: Number(e.target.value) })}>
            {yearsList.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>
        </label>

        {/* Chọn Quý (nếu kỳ là Quý) */}
        {periodType === 'quarter' && (
          <label className="filter" style={{ margin: 0 }}>
            <span>{t('reports.quarter')}</span>
            <select value={quarter} onChange={(e) => set({ quarter: Number(e.target.value) })}>
              {[1, 2, 3, 4].map((qt) => (
                <option key={qt} value={qt}>
                  Quý {qt}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Chọn Tháng (nếu kỳ là Tháng) */}
        {periodType === 'month' && (
          <label className="filter" style={{ margin: 0 }}>
            <span>{t('reports.month')}</span>
            <select value={month} onChange={(e) => set({ month: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Lọc theo Công ty */}
        <label className="filter" style={{ margin: 0 }}>
          <span>{t('reports.company')}</span>
          <select value={companyId} onChange={(e) => set({ companyId: e.target.value })}>
            <option value="all">{t('reports.allCompanies')}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* Tìm kiếm khách hàng */}
        <label className="filter" style={{ margin: 0, flex: '1 1 200px' }}>
          <span>{t('reports.customerName')}</span>
          <input
            type="search"
            value={q}
            placeholder={t('reports.searchCustomer')}
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
      </div>

      {error && (
        <p
          className="formError"
          role="alert"
          style={{ margin: '8px 0 16px', padding: '10px 14px', background: '#fdecea', color: '#b42318', borderRadius: 8 }}
        >
          {error.message}{' '}
          <button type="button" className="tb" onClick={reload}>
            Thử lại
          </button>
        </p>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e40af, #2563eb)',
            color: '#fff',
            padding: '16px 18px',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
        >
          <div style={{ fontSize: 12.5, opacity: 0.9 }}>💰 {t('reports.totalRevenue')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{vnd(totals.revenue || 0)}</div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12.5, color: '#64748b' }}>🧾 {t('reports.totalOrders')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>
            {qtyText(totals.orders || 0)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12.5, color: '#64748b' }}>👥 {t('reports.totalCustomers')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f766e', marginTop: 6 }}>
            {qtyText(totals.customers || 0)}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 12.5, color: '#64748b' }}>🏢 {t('reports.totalCompanies')}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed', marginTop: 6 }}>
            {qtyText(totals.companies || companies.length || 0)}
          </div>
        </div>
      </div>

      {/* Nội dung theo Tab */}
      {(tab === 'overview' || tab === 'company-chart') && (
        <CompanySalesChartSection
          companySalesChart={companySalesChart}
          periodLabels={periodLabels}
          periodType={periodType}
          year={year}
          quarter={quarter}
          month={month}
          t={t}
        />
      )}

      {(tab === 'overview' || tab === 'customer-stats') && (
        <CustomerPurchaseSection
          customerStats={customerStats}
          totals={totals}
          periodType={periodType}
          year={year}
          t={t}
        />
      )}
    </div>
  );
}

function View(props) {
  const { user } = useAuth();
  if (!isOwnerUser(user)) return <Denied />;
  return <OwnerAnalyticsDashboard state={props.state} setState={props.setState} />;
}

const refresh = ({ state, setState }) => setState({ refresh: (state.refresh ?? 0) + 1 }, { replace: true });

export default {
  id: 'reports',
  title: 'reports.title',
  icon: '📊',
  order: 9,
  ownerOnly: true,
  messages,
  Menu,
  refresh,
  View,
  initialState: {
    tab: 'overview',
    periodType: 'month',
    year: curYear(),
    quarter: curQuarter(),
    month: curMonth(),
    companyId: 'all',
    q: '',
    refresh: 0,
  },
};

import BusinessMetricsBridge from './BusinessMetricsBridge';

export const metadata = { title: 'HOCCO · Painel de empresas', robots: { index: false, follow: false, nocache: true } };

export default function CompanyLayout({ children }) {
  return <>{children}<BusinessMetricsBridge/></>;
}

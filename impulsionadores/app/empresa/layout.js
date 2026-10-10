export const metadata = { title: 'HOCCO Hype Empresas', robots: { index: false, follow: false, nocache: true } };

export default function CompanyLayout({ children }) {
  return <>{children}<a href="/patrocinar-app" style={{position:'fixed',right:16,bottom:18,zIndex:9000,background:'#071c3d',color:'#fff',padding:'12px 16px',borderRadius:999,textDecoration:'none',fontWeight:900,fontSize:12,boxShadow:'0 12px 35px rgba(7,28,61,.24)'}}>◆ PATROCINAR O APP</a></>;
}

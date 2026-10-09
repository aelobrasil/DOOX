import './globals.css';
import './living.css';
import './enhancements.css';
import './pwa.css';
import PwaExperience from './PwaExperience';
import SupportShortcut from './SupportShortcut';
import CompanyDateGuard from './CompanyDateGuard';
import HypeBranding from './HypeBranding';

export const metadata={
  title:'Hype',
  description:'Hype — comunidade HOCCO para impulsionar empresas e desbloquear benefícios.',
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,statusBarStyle:'default',title:'Hype'}
};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#075eea'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}<CompanyDateGuard/><SupportShortcut/><PwaExperience/><HypeBranding/><script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}}/></body></html>}

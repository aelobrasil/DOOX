import './globals.css';
import './living.css';
import './enhancements.css';
import './pwa.css';
import PwaExperience from './PwaExperience';
import SupportShortcut from './SupportShortcut';
import CompanyDateGuard from './CompanyDateGuard';

export const metadata={
  title:'Impulsionadores HOCCO',
  description:'Você não apenas assiste. Você impulsiona.',
  manifest:'/manifest.webmanifest',
  appleWebApp:{capable:true,statusBarStyle:'default',title:'HOCCO'}
};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#075eea'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}<CompanyDateGuard/><SupportShortcut/><PwaExperience/><script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}}/></body></html>}

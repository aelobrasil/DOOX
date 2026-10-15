import './globals.css';
import './entry.css';
import './living.css';
import './enhancements.css';
import './hype-effects.css';
import './pwa.css';
import './responsive.css';
import './final-isolation.css';
import PwaExperience from './PwaExperience';
import SupportShortcut from './SupportShortcut';
import CompanyDateGuard from './CompanyDateGuard';
import HypeBranding from './HypeBranding';
import UiPolish from './UiPolish';

export const metadata={
  title:'HOCCO.',
  description:'Uma série documental independente que acompanha uma trajetória real enquanto ela ainda está acontecendo.',
  manifest:'/manifest.webmanifest',
  icons:{icon:'/icon.svg',apple:'/hocco-192.png'},
  appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'HOCCO.'}
};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#111111'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}<CompanyDateGuard/><SupportShortcut/><PwaExperience/><HypeBranding/><UiPolish/><script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}}/></body></html>}

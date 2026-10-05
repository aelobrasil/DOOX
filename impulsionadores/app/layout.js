import './globals.css';
import './living.css';

export const metadata={
  title:'Impulsionadores HOCCO',
  description:'Você não apenas assiste. Você impulsiona.',
  manifest:'/manifest.webmanifest',
  themeColor:'#075eea',
  appleWebApp:{capable:true,statusBarStyle:'default',title:'HOCCO'}
};
export const viewport={width:'device-width',initialScale:1,maximumScale:1,viewportFit:'cover',themeColor:'#075eea'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}<script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`}}/></body></html>}

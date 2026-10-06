import ControlMemberEnhancer from './ControlMemberEnhancer';

export const metadata={title:'HOCCO Control',robots:{index:false,follow:false,nocache:true}};
export default function ControlLayout({children}){return <>{children}<ControlMemberEnhancer/></>}

import ControlMemberEnhancer from './ControlMemberEnhancer';
import ControlRequestEnhancer from './ControlRequestEnhancer';

export const metadata={title:'HOCCO Control',robots:{index:false,follow:false,nocache:true}};
export default function ControlLayout({children}){return <>{children}<ControlMemberEnhancer/><ControlRequestEnhancer/></>}

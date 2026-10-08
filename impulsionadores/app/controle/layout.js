import ControlMemberEnhancer from './ControlMemberEnhancer';
import ControlRequestEnhancer from './ControlRequestEnhancer';
import ControlFutureHype from './ControlFutureHype';
import ControlWinnersMonitor from './ControlWinnersMonitor';

export const metadata={title:'HOCCO Control',robots:{index:false,follow:false,nocache:true}};
export default function ControlLayout({children}){return <>{children}<ControlMemberEnhancer/><ControlRequestEnhancer/><ControlFutureHype/><ControlWinnersMonitor/></>}

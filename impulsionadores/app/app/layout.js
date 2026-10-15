import './member-v3.css';
import HoccoDrops from './HoccoDrops';
import LegalReacceptGuard from './LegalReacceptGuard';
import MemberGovernanceBridge from './MemberGovernanceBridge';
import OfferDetailBridge from './OfferDetailBridge';

export default function MemberLayout({children}){
  return <>{children}<HoccoDrops hideLauncher/><LegalReacceptGuard/><MemberGovernanceBridge/><OfferDetailBridge/></>;
}

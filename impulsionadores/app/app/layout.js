import './member-v3.css';
import HoccoDrops from './HoccoDrops';
import LegalReacceptGuard from './LegalReacceptGuard';
import MemberGovernanceBridge from './MemberGovernanceBridge';

export default function MemberLayout({children}){
  return <>{children}<HoccoDrops/><LegalReacceptGuard/><MemberGovernanceBridge/></>;
}
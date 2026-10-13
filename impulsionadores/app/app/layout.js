import './hocco-next.css';
import LegalReacceptGuard from './LegalReacceptGuard';

export default function MemberLayout({children}){
  return <>{children}<LegalReacceptGuard/></>;
}

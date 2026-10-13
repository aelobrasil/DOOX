import UpcomingHypePreview from './UpcomingHypePreview';
import HypeBenefitExperience from './HypeBenefitExperience';
import HoccoDrops from './HoccoDrops';
import PermanentBrands from './PermanentBrands';
import LegalReacceptGuard from './LegalReacceptGuard';
import MemberGovernanceBridge from './MemberGovernanceBridge';

export default function MemberLayout({children}){
  return <>{children}<UpcomingHypePreview/><HypeBenefitExperience/><HoccoDrops/><PermanentBrands/><LegalReacceptGuard/><MemberGovernanceBridge/></>;
}

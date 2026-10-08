import UpcomingHypePreview from './UpcomingHypePreview';
import HypeBenefitExperience from './HypeBenefitExperience';
import HoccoDrops from './HoccoDrops';

export default function MemberLayout({children}){
  return <>{children}<UpcomingHypePreview/><HypeBenefitExperience/><HoccoDrops/></>;
}

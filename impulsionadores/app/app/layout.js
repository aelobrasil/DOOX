import UpcomingHypePreview from './UpcomingHypePreview';
import HypeBenefitExperience from './HypeBenefitExperience';

export default function MemberLayout({children}){
  return <>{children}<UpcomingHypePreview/><HypeBenefitExperience/></>;
}

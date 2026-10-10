import UpcomingHypePreview from './UpcomingHypePreview';
import HypeBenefitExperience from './HypeBenefitExperience';
import HoccoDrops from './HoccoDrops';
import PermanentBrands from './PermanentBrands';

export default function MemberLayout({children}){
  return <>{children}<UpcomingHypePreview/><HypeBenefitExperience/><HoccoDrops/><PermanentBrands/></>;
}

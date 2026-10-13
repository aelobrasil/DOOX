import './responsive.css';
import './control-v3.css';
import ControlMemberEnhancer from './ControlMemberEnhancer';
import ControlDrops from './ControlDrops';
import ControlSponsors from './ControlSponsors';
import ControlSponsorAccess from './ControlSponsorAccess';
import ControlDataManager from './ControlDataManager';
import ControlPush from './ControlPush';
import ControlDataHealth from './ControlDataHealth';
import ControlGovernance from './ControlGovernance';
import ControlRealtimeBridge from './ControlRealtimeBridge';

export const metadata = {
  title: 'HOCCO Control',
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({ children }) {
  return (
    <>
      {children}
      <ControlRealtimeBridge />
      <ControlMemberEnhancer />
      <ControlDrops />
      <ControlSponsors />
      <ControlSponsorAccess />
      <ControlPush />
      <ControlDataHealth />
      <ControlGovernance />
      <ControlDataManager />
    </>
  );
}
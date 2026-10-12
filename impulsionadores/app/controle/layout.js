import ControlMemberEnhancer from './ControlMemberEnhancer';
import ControlDrops from './ControlDrops';
import ControlSponsors from './ControlSponsors';
import ControlDataManager from './ControlDataManager';
import ControlPush from './ControlPush';

export const metadata = {
  title: 'HOCCO Control',
  robots: { index: false, follow: false, nocache: true },
};

export default function ControlLayout({ children }) {
  return (
    <>
      {children}
      <ControlMemberEnhancer />
      <ControlDrops />
      <ControlSponsors />
      <ControlPush />
      <ControlDataManager />
    </>
  );
}

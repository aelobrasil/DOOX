import CompanyBenefitNotice from './CompanyBenefitNotice';
import CompanyCoverUpload from './CompanyCoverUpload';

export const metadata={title:'HOCCO Hype Empresas',robots:{index:false,follow:false,nocache:true}};
export default function CompanyLayout({children}){return <>{children}<CompanyBenefitNotice/><CompanyCoverUpload/></>}

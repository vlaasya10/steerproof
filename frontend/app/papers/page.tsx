import StudioPapers from '@/components/StudioPapers';
import {PublicHeader, PublicFooter} from '@/components/showcase/PublicChrome';
import {ToastContainer} from '@/components/Toast';

export default function PapersPage() {
  return <><PublicHeader studio/><main className="w-full min-w-0 flex-1"><StudioPapers/></main><PublicFooter/><ToastContainer/></>;
}

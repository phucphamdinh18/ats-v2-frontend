import { LanguageProvider } from "@/components/language";
import OfferApprovalWorkspace from "@/components/offer-approval-workspace";
export default function OfferApprovalPage() {
  return (
    <LanguageProvider>
      <OfferApprovalWorkspace />
    </LanguageProvider>
  );
}

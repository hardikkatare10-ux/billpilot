import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { db } from '../../services/firebase/config';
import type { ShopApplicationStatus } from '../../services/firebase/shopVerification';

interface ShopVerificationStatusProps {
  shopId: string;
  ownerUid: string;
  onContinue: () => void;
}

interface ApplicationStatusRecord {
  status: ShopApplicationStatus;
  submittedAt?: string;
  reviewMessage?: string;
  requestMessage?: string;
}

const STATUS_LABELS: Record<ShopApplicationStatus, string> = {
  draft: 'Draft',
  pending_verification: 'Pending admin review',
  additional_information_required: 'Additional information required',
  approved: 'Approved by admin review',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const ShopVerificationStatus: React.FC<ShopVerificationStatusProps> = ({
  shopId,
  ownerUid,
  onContinue,
}) => {
  const [application, setApplication] = useState<ApplicationStatusRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    return onSnapshot(
      doc(db, 'shops', shopId, 'private', 'verificationApplication'),
      (snapshot) => {
        setApplication(snapshot.exists() ? snapshot.data() as ApplicationStatusRecord : null);
        setError(null);
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error('Could not read the applicant shop verification status:', snapshotError);
        setError('Application status could not be loaded. Refresh while signed in to try again.');
        setIsLoading(false);
      }
    );
  }, [shopId, ownerUid]);

  const canResubmit = !application ||
    application.status === 'additional_information_required';

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left" aria-live="polite">
      <div className="flex items-start gap-3">
        {application?.status === 'approved' ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        ) : application?.status === 'rejected' || application?.status === 'suspended' ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        ) : application?.status === 'additional_information_required' ? (
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        ) : (
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900">Shop verification status</h3>
          {isLoading ? (
            <p className="mt-1 text-xs text-slate-600">Loading your application status…</p>
          ) : error ? (
            <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>
          ) : !application ? (
            <>
              <p className="mt-1 text-xs text-slate-700">
                Required photographs and business documents have not all been submitted yet.
              </p>
              {canResubmit && (
                <button type="button" onClick={onContinue} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                  Complete shop application uploads
                </button>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-xs font-semibold text-slate-800">
                {STATUS_LABELS[application.status] || application.status}
              </p>
              {application.submittedAt && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Submitted {new Date(application.submittedAt).toLocaleString('en-IN')}
                </p>
              )}
              {(application.status === 'additional_information_required' ||
                application.status === 'rejected' ||
                application.status === 'suspended') &&
                (application.requestMessage || application.reviewMessage) && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-white p-2 text-xs text-slate-700">
                  Admin message: {application.requestMessage || application.reviewMessage}
                </p>
              )}
              {canResubmit && (
                <button type="button" onClick={onContinue} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                  Submit requested information
                </button>
              )}
              <p className="mt-2 text-[10px] text-slate-500">
                Admin review records do not replace legal, identity or regulatory verification.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

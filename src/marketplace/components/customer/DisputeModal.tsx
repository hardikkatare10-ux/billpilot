/**
 * BillPilot Local - Dispute and Return Modal
 * 
 * Allows customers to submit structured return, damage, or refund claims
 * with categorized reasons and photo evidence.
 */

import React, { useState } from 'react';
import { X, AlertCircle, Camera, CheckCircle } from 'lucide-react';
import { Order, ReturnComplaintRequest } from '../../types';
import { dbStore } from '../../services/db/store';

interface DisputeModalProps {
  order: Order;
  onClose: () => void;
  onSubmitted: () => void;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({ order, onClose, onSubmitted }) => {
  const [reason, setReason] = useState<ReturnComplaintRequest['reason']>('damaged_product');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoList, setPhotoList] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleAddPhoto = () => {
    if (photoUrl.trim()) {
      setPhotoList([...photoList, photoUrl.trim()]);
      setPhotoUrl('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoList((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      dbStore.submitReturnComplaint({
        orderId: order.id,
        customerId: order.customerId,
        reason,
        description,
        photoEvidenceUrls: photoList,
      });
      setSubmittedSuccess(true);
      setTimeout(() => {
        onSubmitted();
      }, 1500);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle className="w-4 h-4" />
            <h3 className="text-sm font-bold text-slate-900">Report Issue / Request Return</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dispute modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="text-base font-bold text-slate-900">Dispute Claim Submitted</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your claim for Order #{order.orderNumber} has been logged for review with {order.shopName} and marketplace arbitration.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="font-semibold text-slate-900">Order #{order.orderNumber}</p>
              <p className="text-slate-500 mt-0.5">Store: {order.shopName}</p>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Issue Category</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnComplaintRequest['reason'])}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="damaged_product">Damaged or broken product</option>
                <option value="defective_product">Defective / sub-standard quality</option>
                <option value="wrong_product">Wrong product received</option>
                <option value="missing_item">Missing item from parcel</option>
                <option value="expired_unsafe">Expired / near expiry / unsealed</option>
                <option value="other">Other order complaint</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Detailed Explanation</label>
              <textarea
                required
                rows={3}
                placeholder="Describe the issue observed upon doorstep delivery..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Supporting Photo Evidence (Optional)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  placeholder="Paste image URL..."
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Add Link
                </button>
                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 rounded-lg flex items-center justify-center gap-1 cursor-pointer">
                  <span>Upload File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {photoList.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto py-1">
                  {photoList.map((url, i) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                      <img src={url} alt="Evidence" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Submitting Claim...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

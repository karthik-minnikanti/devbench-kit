import { useState } from "react";
import { validateLicense } from "../services/license";
import { useStore } from "../state/store";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [loading, setLoading] = useState(false);
  const checkLicense = useStore((state) => state.checkLicense);

  if (!isOpen) return null;

  const handleValidate = async () => {
    setLoading(true);
    try {
      await validateLicense(licenseKey);
      await checkLicense();
      onClose();
      setLicenseKey("");
    } catch (error) {
      alert("Failed to validate license");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center">
      <div className="modal-panel p-6 w-96">
        <h3 className="title-md mb-4">License Activation</h3>
        <input
          type="text"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="Enter license key"
          className="input-field w-full mb-4"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleValidate}
            disabled={loading || !licenseKey.trim()}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {loading ? "Validating..." : "Activate"}
          </button>
        </div>
      </div>
    </div>
  );
}

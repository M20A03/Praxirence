import React from 'react';
import { X, CheckCheck, FileText, Download, MessageSquare, ShieldCheck } from 'lucide-react';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '420px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
        border: '1px solid #cbd5e1'
      }}>
        {/* WhatsApp Green Header */}
        <div style={{
          background: '#075E54',
          color: '#ffffff',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#128C7E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem'
            }}>
              P
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.925rem', fontWeight: 700 }}>Praxirence Care Desk</span>
                <ShieldCheck size={14} color="#25D366" />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#A7F3D0' }}>Official WhatsApp Business Account</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* WhatsApp Chat Body */}
        <div style={{
          background: '#ECE5DD',
          padding: '16px',
          minHeight: '340px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: 'sans-serif'
        }}>
          {/* Security Notice */}
          <div style={{
            alignSelf: 'center',
            background: '#FFEECD',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.68rem',
            color: '#54656F',
            textAlign: 'center',
            maxWidth: '90%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            🔒 Messages and calls are end-to-end encrypted under DPDP Act 2023.
          </div>

          {/* Incoming Message Bubble */}
          <div style={{
            alignSelf: 'flex-start',
            background: '#ffffff',
            padding: '10px 12px',
            borderRadius: '0 10px 10px 10px',
            maxWidth: '90%',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <p style={{ fontSize: '0.825rem', color: '#111B21', margin: '0 0 6px 0', lineHeight: 1.4 }}>
              नमस्ते <b>रमेश शर्मा जी</b>,<br />
              डॉ. मयंक राज (NMC: 84920-A) द्वारा आपका आधिकारिक प्रिस्क्रिप्शन व केयर प्लान तैयार कर भेजा गया है।
            </p>

            {/* Attached PDF Card */}
            <div style={{
              background: '#F0F2F5',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginTop: '8px',
              border: '1px solid #D1D7DB'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <FileText size={20} color="#EA4335" />
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111B21', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Care_Plan_Ramesh_Sharma.pdf
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#667781' }}>124 KB • Verified Signed PDF</span>
                </div>
              </div>

              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                <Download size={14} />
              </div>
            </div>

            {/* Vernacular Dosage Summary */}
            <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#3B4A54', lineHeight: 1.4 }}>
              <b>दवा लेने का समय:</b><br />
              • <b>Metformin 500mg</b>: 1 गोली सुबह नाश्ते के बाद और 1 गोली रात खाने के बाद।<br />
              • <b>Telmisartan 40mg</b>: 1 गोली सुबह नाश्ते के बाद।
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
              <span style={{ fontSize: '0.65rem', color: '#667781' }}>10:32 AM</span>
              <CheckCheck size={14} color="#53BDEB" />
            </div>
          </div>
        </div>

        {/* Modal Footer CTA */}
        <div style={{ padding: '12px 16px', background: '#F0F2F5', textAlign: 'center', borderTop: '1px solid #E2E8F0' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.85rem' }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

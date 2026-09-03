import React, { useState } from 'react';
import { X, CheckCheck, ExternalLink, Copy, Check, MessageSquare, ShieldCheck } from 'lucide-react';
import { Visit, Patient } from '../types';

interface WhatsAppPreviewModalProps {
  visit: Visit;
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppPreviewModal: React.FC<WhatsAppPreviewModalProps> = ({
  visit,
  patient,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Format WhatsApp message exactly as sent by the backend Meta WhatsApp service
  const formatPrescriptionText = (): string => {
    let msg = `🏥 *PRAXIRENCE HEALTHCARE CLINIC*\n`;
    msg += `------------------------------------\n`;
    msg += `📋 *Official Patient Care Plan & Prescription*\n`;
    msg += `👤 *Patient:* ${patient.name}\n`;
    msg += `👨‍⚕️ *Consulting Doctor:* ${visit.doctor_name || 'Dr. Sarah Jenkins, M.D.'}\n`;
    msg += `📅 *Date:* ${new Date(visit.date).toLocaleDateString()}\n\n`;

    msg += `🩺 *DIAGNOSIS:*\n${visit.diagnosis}\n\n`;

    msg += `💊 *PRESCRIBED MEDICINES:*\n`;
    visit.medicines.forEach((med, i) => {
      msg += `${i + 1}. *${med.name}* (${med.dosage})\n`;
      msg += `   • Frequency: ${med.frequency}\n`;
      msg += `   • Duration: ${med.duration_days} days\n`;
      if (med.instructions) {
        msg += `   • Notes: ${med.instructions}\n`;
      }
    });

    if (visit.reminders && visit.reminders.length > 0) {
      msg += `\n⏰ *MEDICATION REMINDERS:*\n`;
      visit.reminders.forEach((rem) => {
        msg += `   • ${rem.time} — ${rem.medicine_name} (${rem.dosage})\n`;
      });
    }

    msg += `\n⚠️ *CLINICAL ADVISORY:*\n`;
    msg += `• Take all medications strictly as advised.\n`;
    msg += `• In case of adverse reactions, contact the clinic immediately.\n`;
    msg += `• Emergency Hotline: 108 / 112\n`;
    msg += `------------------------------------\n`;
    msg += `_Delivered securely via Praxirence Meta WhatsApp Cloud API_`;

    return msg;
  };

  const formattedText = formatPrescriptionText();

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhone = patient.phone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedText)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{
          maxWidth: '520px',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          background: '#efeae2',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* WhatsApp App Header */}
        <div style={{
          background: '#075e54',
          color: '#ffffff',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1.1rem'
            }}>
              {patient.name.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{patient.name}</span>
                <span title="Verified WhatsApp Number" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <ShieldCheck size={14} color="#25D366" />
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                {patient.phone} • Online
              </div>
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

        {/* WhatsApp Chat Area */}
        <div style={{
          padding: '20px',
          maxHeight: '420px',
          overflowY: 'auto',
          background: '#efeae2',
          backgroundImage: 'radial-gradient(#0000000a 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}>
          {/* Encryption Notice */}
          <div style={{
            background: 'rgba(255, 235, 179, 0.9)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            textAlign: 'center',
            color: '#54656f',
            marginBottom: '16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            🔒 Messages to this chat are end-to-end encrypted and HIPAA audited.
          </div>

          {/* Sent Prescription Bubble */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '8px'
          }}>
            <div style={{
              maxWidth: '92%',
              background: '#dcf8c6',
              borderRadius: '12px 12px 2px 12px',
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              position: 'relative',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              color: '#111b21',
              fontFamily: 'Segoe UI, Helvetica Neue, Helvetica, Lucida Grande, Arial, Ubuntu, Cantarell, Fira Sans, sans-serif'
            }}>
              <div style={{ whiteSpace: 'pre-line' }}>
                {formattedText}
              </div>

              {/* Delivery info & blue ticks */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                marginTop: '6px',
                fontSize: '0.7rem',
                color: '#667781'
              }}>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <CheckCheck size={15} color="#53bdeb" />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div style={{
          background: '#ffffff',
          padding: '14px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 14px' }}
          >
            {copied ? <Check size={16} color="var(--emerald-500)" /> : <Copy size={16} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
              style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}
            >
              <ExternalLink size={15} />
              <span>Open in WhatsApp Web</span>
            </a>

            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', padding: '8px 14px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

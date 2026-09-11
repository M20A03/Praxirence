import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export interface VitalDataPoint {
  time: string;
  heartRate: number;
  systolic: number;
  diastolic: number;
  spo2: number;
}

interface VitalsChartProps {
  data?: VitalDataPoint[];
  title?: string;
}

const DEFAULT_VITALS: VitalDataPoint[] = [
  { time: '08:00', heartRate: 72, systolic: 120, diastolic: 80, spo2: 98 },
  { time: '10:00', heartRate: 76, systolic: 122, diastolic: 82, spo2: 99 },
  { time: '12:00', heartRate: 84, systolic: 128, diastolic: 85, spo2: 97 },
  { time: '14:00', heartRate: 74, systolic: 119, diastolic: 79, spo2: 98 },
  { time: '16:00', heartRate: 78, systolic: 124, diastolic: 81, spo2: 99 },
  { time: '18:00', heartRate: 71, systolic: 118, diastolic: 78, spo2: 99 }
];

export const VitalsChart: React.FC<VitalsChartProps> = ({
  data = DEFAULT_VITALS,
  title = "Clinical Vitals Trends (Last 12 Hours)"
}) => {
  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E2E8F0',
      padding: '20px',
      marginTop: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
            {title}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
            Continuous monitoring via ABDM IoT sync
          </p>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: '#F0FDF4',
          color: '#15803D',
          border: '1px solid #DCFCE7'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16A34A' }} />
          Stable Vital Telemetry
        </span>
      </div>

      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94A3B8" fontSize={11} domain={[60, 140]} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                border: 'none',
                borderRadius: '8px',
                color: '#F8FAFC',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            <Line
              type="monotone"
              dataKey="systolic"
              name="Systolic BP"
              stroke="#E11D48"
              strokeWidth={2}
              dot={{ r: 3, fill: '#E11D48' }}
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              name="Diastolic BP"
              stroke="#0284C7"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0284C7' }}
            />
            <Line
              type="monotone"
              dataKey="heartRate"
              name="Heart Rate (BPM)"
              stroke="#0D9488"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0D9488' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

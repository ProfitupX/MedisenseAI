/**
 * WaveChart.jsx — Real-time rPPG pulse waveform visualization
 * Live streaming chart using Chart.js with medical styling.
 */

import React, { useEffect, useRef } from 'react';
import {
  Chart,
  LineController, LineElement, PointElement,
  LinearScale, CategoryScale,
  Filler, Tooltip,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const DISPLAY_POINTS = 150;

export default function WaveChart({ waveBuffer = [], phase, title = 'rPPG Pulse Signal' }) {
  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);

  // ── Init chart ──────────────────────────────────────────
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(0,212,255,0.3)');
    gradient.addColorStop(1, 'rgba(0,212,255,0.0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Array(DISPLAY_POINTS).fill(''),
        datasets: [{
          data: Array(DISPLAY_POINTS).fill(0),
          borderColor: '#00d4ff',
          borderWidth: 2,
          fill: true,
          backgroundColor: gradient,
          tension: 0.4,
          pointRadius: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { display: false },
          y: {
            display: true,
            min: -2, max: 2,
            grid: { color: 'rgba(30,58,110,0.4)', drawBorder: false },
            ticks: {
              color: 'rgba(148,163,184,0.5)',
              font: { size: 10, family: 'JetBrains Mono' },
              stepSize: 1,
            }
          }
        },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        elements: { line: { capBezierPoints: false } },
      }
    });

    return () => chartRef.current?.destroy();
  }, []);

  // ── Push new data ────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const ds = chartRef.current.data.datasets[0];

    const display = waveBuffer.slice(-DISPLAY_POINTS);
    while (display.length < DISPLAY_POINTS) display.unshift(0);

    ds.data = display;

    // Color based on phase
    const colorScheme = phase === 'scanning'
      ? { stroke: '#00d4ff', fill: 'rgba(0, 212, 255, 0.25)' }
      : phase === 'results'
      ? { stroke: '#00ff9d', fill: 'rgba(0, 255, 157, 0.25)' }
      : { stroke: '#475569', fill: 'rgba(71, 85, 105, 0.25)' };

    ds.borderColor = colorScheme.stroke;

    // Rebuild gradient
    const ctx = canvasRef.current.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 120);
    grd.addColorStop(0, colorScheme.fill);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ds.backgroundColor = grd;

    chartRef.current.update('none');
  }, [waveBuffer, phase]);

  return (
    <div className="medical-card p-4 glow-cyan">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${phase === 'scanning' ? 'bg-cyan-400 pulse-animate' : 'bg-slate-500'}`} />
          <span className="text-xs font-mono text-slate-400 tracking-wider uppercase">{title}</span>
        </div>
        {phase === 'scanning' && (
          <span className="text-xs text-cyan-400 font-mono">LIVE</span>
        )}
      </div>
      <div style={{ height: '110px' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

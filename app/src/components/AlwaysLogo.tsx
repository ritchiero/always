'use client';

import { useMemo } from 'react';

interface AlwaysLogoProps {
  size?: 'small' | 'default' | 'large';
}

const sizeConfig = {
  small: { width: 32, height: 16, strokeWidth: 16 },
  default: { width: 44, height: 22, strokeWidth: 16 },
  large: { width: 140, height: 70, strokeWidth: 14 },
};

export function AlwaysLogo({ size = 'default' }: AlwaysLogoProps) {
  const { width, height, strokeWidth } = sizeConfig[size];

  const path = useMemo(() => {
    const points: string[] = [];
    const steps = 200;
    const a = 160;
    const cx = 200;
    const cy = 100;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      const sinT = Math.sin(t);
      const cosT = Math.cos(t);
      const denom = 1 + sinT * sinT;
      const x = cx + (a * cosT) / denom;
      const y = cy + (a * sinT * cosT) / denom;
      points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }
    points.push('Z');
    return points.join(' ');
  }, []);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={path}
        stroke="#FFFFFF"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlwaysLogoFull() {
  return (
    <div className="flex items-center gap-2">
      <AlwaysLogo size="small" />
      <span className="text-lg font-semibold tracking-wide text-white">
        Always
      </span>
    </div>
  );
}

export default AlwaysLogo;

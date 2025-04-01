import React, { useState } from 'react';

// === Smooth Spline Helper: Catmull-Rom ===
function catmullRomSpline(points, steps = 300) {
  const result = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[i + 1];

    for (let t = 0; t <= 1; t += 1 / steps) {
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
      );

      const y = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
      );

      result.push([x, y]);
    }
  }

  return result;
}

// === Arc Generator (for tip/tail) ===
function arcPoints(cx, cy, r, start, end, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (end - start) * (i / steps);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push([x, y]);
  }
  return pts;
}

// === Sidecut radius from 3 points ===
function computeCircleRadius(p1, p2, p3) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;

  const a = Math.hypot(x1 - x2, y1 - y2);
  const b = Math.hypot(x2 - x3, y2 - y3);
  const c = Math.hypot(x3 - x1, y3 - y1);
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const radius = (a * b * c) / (4 * area);
  return radius;
}

// === Generate full ski outline ===
function generateSkiOutline({
  totalLength,
  waistWidth,
  tipArcRadius,
  tailArcRadius,
  tipTaperWidth,
  tailTaperWidth,
  tipTaperOffset,
  tailTaperOffset,
  tipTaperLength,
  tailTaperLength,
  setback,
}) {
  const arcEndX = tipArcRadius;
  const arcStartTailX = totalLength - tailArcRadius;

  const tipControlX = tipTaperOffset + tipTaperLength;
  const tailControlX = totalLength - tailTaperOffset - tailTaperLength;
  const waistX = totalLength / 2 + setback;

  const controlPoints = [
    [arcEndX, tipArcRadius],
    [tipControlX, tipTaperWidth / 2],
    [waistX, waistWidth / 2],
    [tailControlX, tailTaperWidth / 2],
    [arcStartTailX, tailArcRadius],
  ];

  const sidecut = catmullRomSpline(controlPoints);
  const noseArc = arcPoints(tipArcRadius, 0, tipArcRadius, Math.PI, Math.PI / 2);
  const tailArc = arcPoints(totalLength - tailArcRadius, 0, tailArcRadius, Math.PI / 2.85, 0);

  const upper = [...noseArc, ...sidecut, ...tailArc];
  const lower = upper.map(([x, y]) => [x, -y]).reverse();
  const full = [...upper, ...lower];

  return {
    d: full.map(([x, y], i) =>
      `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    ).join(' ') + ' Z',
    controlPoints: [controlPoints[1], controlPoints[2], controlPoints[3]],
  };
}

export default function SkiPreview() {
  const [params, setParams] = useState({
    totalLength: 1870,
    waistWidth: 112,
    tipArcRadius: 56,
    tailArcRadius: 56,
    tipTaperWidth: 135,
    tailTaperWidth: 130,
    tipTaperOffset: 250,
    tailTaperOffset: 150,
    tipTaperLength: 100,
    tailTaperLength: 100,
    setback: 100,
  });

  const update = (key) => (e) => {
    const { value } = e.target;
    setParams((prev) => ({ ...prev, [key]: value === '' ? '' : Number(value) }));
  };

  const safeParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, v === '' ? 0 : v])
  );

  const { d: pathD, controlPoints } = generateSkiOutline(safeParams);

  const radius = computeCircleRadius(...controlPoints); // in mm
  const radiusMeters = (radius / 1000).toFixed(1); // convert to meters

  const downloadSVG = () => {
    const paramText = Object.entries(safeParams)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${v} mm`)
      .join('\n');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${safeParams.totalLength}" height="300" viewBox="0 -150 ${safeParams.totalLength} 300">
  <path d="${pathD}" fill="lightgray" stroke="black" stroke-width="2"/>
  <circle cx="${safeParams.totalLength / 2 + safeParams.setback}" cy="0" r="4" fill="red"/>
  <text x="10" y="-130" font-size="16" fill="black">Tip</text>
  <text x="${safeParams.totalLength - 60}" y="-130" font-size="16" fill="black">Tail</text>
  <text x="10" y="140" font-size="12" fill="gray">${paramText.replace(/\n/g, '&#10;')}</text>
</svg>
`.trim();

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ski-design.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '1em', flexWrap: 'wrap', marginBottom: '1em' }}>
        {Object.keys(params).map((key) => (
          <label key={key}>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} (mm):
            <input
              type="number"
              value={params[key] === '' ? '' : params[key]}
              onChange={update(key)}
              style={{ width: '80px' }}
            />
          </label>
        ))}
      </div>

      <div style={{ margin: '1em 0', fontWeight: 'bold' }}>
        Approx. Sidecut Radius: {radiusMeters} m
      </div>

      <svg
        viewBox={`0 -150 ${safeParams.totalLength} 300`}
        height="250"
      >
        <path d={pathD} fill="lightgray" stroke="black" strokeWidth="1" />
        <circle cx={safeParams.totalLength / 2 + safeParams.setback} cy="0" r="4" fill="red" />
        <text
          x={safeParams.totalLength / 2 + safeParams.setback + 5}
          y="20"
          fontSize="12"
          fill="red"
        >
          Mount Point Setback: {safeParams.setback} mm
        </text>
        <text x="10" y="-130" fontSize="16" fill="black">Tip</text>
        <text x={safeParams.totalLength - 60} y="-130" fontSize="16" fill="black">Tail</text>
      </svg>

      <button onClick={downloadSVG} style={{ marginTop: '1em' }}>
        Download Shape
      </button>
    </div>
  );
}

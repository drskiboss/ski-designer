import React, { useState, useEffect } from 'react';

// === Catmull-Rom spline ===
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
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      result.push([x, y]);
    }
  }
  return result;
}

function arcPoints(cx, cy, r, start, end, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (end - start) * (i / steps);
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
}

function computeCircleRadius(p1, p2, p3) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const a = Math.hypot(x1 - x2, y1 - y2);
  const b = Math.hypot(x2 - x3, y2 - y3);
  const c = Math.hypot(x3 - x1, y3 - y1);
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  return (a * b * c) / (4 * area);
}

function generateSkiOutline(params, classicMode) {
  const {
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
  } = params;

  const waistX = totalLength / 2 + setback;

  let controlPoints;
  if (classicMode) {
    controlPoints = [
      [tipArcRadius, tipArcRadius],
      [waistX, waistWidth / 2],
      [totalLength - tailArcRadius, tailArcRadius],
    ];
  } else {
    const enforcedTipOffset = (tipTaperOffset < tipArcRadius) ? tipArcRadius : tipTaperOffset;
    const enforcedTailOffset = (tailTaperOffset < tailArcRadius) ? tailArcRadius : tailTaperOffset;

    const tipX = enforcedTipOffset + tipTaperLength;
    const tailX = totalLength - enforcedTailOffset - tailTaperLength;

    controlPoints = [
      [tipArcRadius, tipArcRadius],
      [tipX, tipTaperWidth / 2],
      [waistX, waistWidth / 2],
      [tailX, tailTaperWidth / 2],
      [totalLength - tailArcRadius, tailArcRadius],
    ];
  }

  const sidecut = catmullRomSpline(controlPoints);
  const noseArc = arcPoints(tipArcRadius, 0, tipArcRadius, Math.PI, Math.PI / 2);
  const tailArc = arcPoints(totalLength - tailArcRadius, 0, tailArcRadius, Math.PI / 2.85, 0);

  const upper = [...noseArc, ...sidecut, ...tailArc];
  const lower = upper.map(([x, y]) => [x, -y]).reverse();
  const full = [...upper, ...lower];

  return {
    d: full.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z',
    controlPoints: classicMode ? controlPoints : [controlPoints[1], controlPoints[2], controlPoints[3]],
  };
}

export default function SkiPreview() {
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.margin = '';
      document.body.style.overflowX = '';
    };
  }, []);

  const initialParams = {
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
  };

  const constraints = {
    totalLength: { min: 1000, max: 2000 },
    waistWidth: { min: 65, max: 320 },
    tipArcRadius: { min: 30, max: 160 },
    tailArcRadius: { min: 30, max: 160 },
    tipTaperWidth: { min: 65, max: 350 },
    tailTaperWidth: { min: 65, max: 350 },
    tipTaperOffset: { min: 0, max: 350 },
    tailTaperOffset: { min: 0, max: 350 },
    tipTaperLength: { min: 0, max: 300 },
    tailTaperLength: { min: 0, max: 300 },
    setback: { min: 100, max: 100 },
  };

  const isParamValid = (key, value) => {
    if (!constraints[key]) return true;
    const { min, max } = constraints[key];
    const num = Number(value);
    return num >= min && num <= max;
  };

  const areAllParamsValid = (paramSet) =>
    Object.entries(paramSet).every(([key, value]) => isParamValid(key, value));

  const [touchedFields, setTouchedFields] = useState({});
  const [params, setParams] = useState(initialParams);
  const [editingParams, setEditingParams] = useState(initialParams);
  const [lastValidParams, setLastValidParams] = useState(initialParams);
  const [classicMode, setClassicMode] = useState(false);

  const handleEditChange = (key) => (e) => {
    const newValue = e.target.value;
    setEditingParams((prev) => ({ ...prev, [key]: newValue }));
  };

  const commitChange = (key) => {
    const value = editingParams[key] === '' ? 0 : Number(editingParams[key]);
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    setTouchedFields((prev) => ({ ...prev, [key]: true }));

    if (areAllParamsValid(newParams)) {
      setLastValidParams(newParams);
    }
  };

  const handleKeyDown = (key) => (e) => {
    if (e.key === 'Enter') e.target.blur();
  };

  const safeParams = lastValidParams;
  const { d: pathD, controlPoints } = generateSkiOutline(safeParams, classicMode);
  const radius = computeCircleRadius(...controlPoints);
  const radiusMeters = (radius / 1000).toFixed(1);

  const downloadSVG = () => {
    const paramText = Object.entries(safeParams)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${v} mm`).join('\n');

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${safeParams.totalLength}" height="300" viewBox="0 -150 ${safeParams.totalLength} 300">
  <path d="${pathD}" fill="lightgray" stroke="black" stroke-width="2"/>
  <circle cx="${safeParams.totalLength / 2 + safeParams.setback}" cy="0" r="4" fill="red"/>
  <text x="10" y="-130" font-size="16" fill="black">Tip</text>
  <text x="${safeParams.totalLength - 60}" y="-130" font-size="16" fill="black">Tail</text>
  <text x="10" y="140" font-size="12" fill="gray">${paramText.replace(/\n/g, '&#10;')}</text>
</svg>`.trim();

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
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <h1 style={{ textAlign: 'center', fontSize: '1.8em', fontWeight: '200', margin: '1em 0 2em 0' }}>
        The Big Skis Shaper
      </h1>

      <div style={{ width: '100vw', background: '#333', color: 'white', padding: '1em', borderBottom: '1px solid #444', display: 'flex', flexWrap: 'wrap', gap: '1em', justifyContent: 'center' }}>
        {Object.keys(params).map((key) => {
          const isTaper = key.toLowerCase().includes('taper');
          if (classicMode && isTaper) return null;
          return (
            <label key={key} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85em' }}>
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  value={editingParams[key]}
                  onChange={handleEditChange(key)}
                  onBlur={() => commitChange(key)}
                  onKeyDown={handleKeyDown(key)}
                  style={{ width: '60px', padding: '6px 12px' }}
                />
                <span style={{ fontSize: '0.8em' }}>mm</span>
              </div>
              {constraints[key] && touchedFields[key] && (
                (Number(editingParams[key]) < constraints[key].min || Number(editingParams[key]) > constraints[key].max) && (
                  <span style={{ color: 'yellow', fontSize: '0.8em' }}>
                    Must be between {constraints[key].min} and {constraints[key].max}
                  </span>
                )
              )}
            </label>
          );
        })}
        <div style={{ alignItems: 'center', gap: '4px' }}>
          <input
            id="classic-mode-toggle"
            type="checkbox"
            checked={classicMode}
            onChange={(e) => setClassicMode(e.target.checked)}
          />
          <label htmlFor="classic-mode-toggle" style={{ fontSize: '0.85em', cursor: 'pointer' }}>
            🌹 No Taper Mode
          </label>
        </div>
      </div>

      <div style={{ fontWeight: '200', textAlign: 'center', marginTop: '2em' }}>
        Approx. Sidecut Radius: {radiusMeters} m
      </div>

      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <svg viewBox={`0 -200 ${safeParams.totalLength} 400`} height="300">
            <path d={pathD} fill="lightgray" stroke="black" strokeWidth="1" />
            <circle cx={safeParams.totalLength / 2 + safeParams.setback} cy="0" r="4" fill="red" />
            <text x={safeParams.totalLength / 2 + safeParams.setback + 5} y="20" fontSize="12" fill="red">
              Mount Point Setback: {safeParams.setback} mm
            </text>
            <text x="10" y="-130" fontSize="16" fill="black">Tip</text>
            <text x={safeParams.totalLength - 60} y="-130" fontSize="16" fill="black">Tail</text>
          </svg>
        </div>
        <button onClick={downloadSVG} style={{ marginTop: '1em' }}>
          Download Shape
        </button>
      </div>
    </div>
  );
}

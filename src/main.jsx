// Fixed calculation: restrict vertical drift precisely between 62% and 88% of hero height
function diyaWaterPosition(index) {
  // Deterministic spread seeded by index
  const seedY = ((index * 37 + 19) % 100) / 100;
  
  // River area spans from y = 62% to y = 88%
  const y = 0.62 + seedY * 0.26;

  // Calculate dynamic river bank boundaries (trapezoidal bank perspective)
  const bankProgress = (y - 0.62) / 0.26;
  const leftLimit = 0.18 + bankProgress * 0.08;  // Bank narrows inward towards mid-river
  const rightLimit = 0.82 - bankProgress * 0.08;

  const seedX = ((index * 53 + 11) % 97) / 97;
  const x = leftLimit + seedX * (rightLimit - leftLimit);

  return {
    left: `${(x * 100).toFixed(2)}%`,
    top: `${(y * 100).toFixed(2)}%`,
    '--drift-x': `${(seedX * 24 - 12).toFixed(1)}px`,
    '--drift-y': `${(seedY * 12 - 6).toFixed(1)}px`
  };
}

// Format relative time helper for floating tooltips
function formatRelativeTime(timestamp, lang) {
  if (!timestamp) return lang === 'hi' ? 'अभी' : 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (diffSec < 60) return lang === 'hi' ? 'अभी' : 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}${lang === 'hi' ? 'मि' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}${lang === 'hi' ? 'घं' : 'h'}`;
}

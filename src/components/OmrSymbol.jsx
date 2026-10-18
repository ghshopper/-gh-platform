export default function OmrSymbol({ size = 24, primaryColor = '#722F37', secondaryColor = '#B5915F', className = '' }) {
  // Use a hard-stop linear gradient to split the single path into two colors:
  // Top part (Ayn curve + middle bar) = primaryColor (Burgundy)
  // Bottom part (Raa base + bottom bar) = secondaryColor (Gold)
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="1750 1120 310 150" 
      width={size} 
      height={size} 
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        <linearGradient id="omrGrad" x1="0" y1="0" x2="0" y2="1">
          {/* 62% is approximately the gap between the two horizontal bars */}
          <stop offset="62%" stopColor={primaryColor} />
          <stop offset="62%" stopColor={secondaryColor} />
        </linearGradient>
      </defs>
      <path 
        fill="url(#omrGrad)" 
        d="M2044.8,1220.7c-6.5-11.2-11.8-23.3-14.1-36.1-1.6-9-1.4-18.5.3-27.7,6.8-5,14.8-8.3,23.6-9.5,8.7-1.2,17.1-.4,25.2,3,8.5,3.5,16,9.1,22.8,15.1,7.6,6.8,20.8,22.4,20.8,22.4l23.5-40.7c-8.8-11-18.4-21.6-29.9-29.8-5.7-4.1-12-7.6-18.8-9.6-6.4-1.9-12.9-2.1-19.4-1.3-11.4,1.4-22.2,6.3-30.2,14.5-6.5,6.6-32.9,50-37.4,63.4-3.7,11-5.6,23.1-4.7,34.6,0,.5,0,1,.2,1.5h-39.8l-23.5,40.7h77.9c7.8,13.5,17.6,26,28.7,37h-127.9l-23.5,40.7h286.7l23.5-40.7h-62.5c-26.1-3.5-50.1-19.2-68.9-37h152.7l23.5-40.7h-208.7v.2Z"
      />
      <path 
        fill="url(#omrGrad)" 
        d="M2040.3,1131.8c.2-.4.4-.7.5-1.1,3.1-6.2,8.5-12.7-2.3,5.2.6-1.4,1.2-2.7,1.8-4.1Z" 
      />
    </svg>
  );
}

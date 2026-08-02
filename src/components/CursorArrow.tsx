import { useId, type CSSProperties } from 'react'

type CursorArrowProps = {
  color?: string
  size?: number
  rotation?: number
  className?: string
  style?: CSSProperties
}

export function CursorArrow({
  color = '#5865F2',
  size = 24,
  rotation = 0,
  className,
  style,
}: CursorArrowProps) {
  // Unique per instance so multiple arrows don't share one filter definition.
  const filterId = `cursor-shadow-${useId()}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ transform: `rotate(${rotation}deg)`, ...style }}
      aria-hidden="true"
    >
      <g filter={`url(#${filterId})`}>
        <path
          d="M15.5198 2.72228L20.0783 18.7138C20.3137 19.5395 19.4561 20.2526 18.6763 19.8795L3.57356 12.6544C2.77055 12.2703 2.8309 11.1177 3.66959 10.8205L9.88095 8.61973C10.1065 8.5398 10.2957 8.38251 10.4143 8.17627L13.6803 2.49752C14.1213 1.73074 15.2774 1.872 15.5198 2.72228Z"
          fill={color}
        />
      </g>
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="23.125"
          height="23.9792"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
      </defs>
    </svg>
  )
}

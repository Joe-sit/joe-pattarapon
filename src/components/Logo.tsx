type LogoProps = {
  width?: number
  height?: number
  className?: string
}

/** Static "JOE" wordmark — the resting state of the splash animation. */
export function Logo({ width = 93, height = 32, className }: LogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="-10 -10 259 104"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Joe"
    >
      <defs>
        {/* J mask: cuts corner + hook */}
        <mask id="nav-j-mask">
          <rect x="-10" y="-10" width="259" height="104" fill="white" />
          <path
            d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55Z"
            fill="black"
          />
          <rect x="-1" y="-1" width="35" height="32" fill="black" />
        </mask>
        {/* E mask: cuts counter + opening */}
        <mask id="nav-e-mask">
          <rect x="-10" y="-10" width="259" height="104" fill="white" />
          <rect x="185" y="18" width="35" height="16" rx="8" fill="black" />
          <path
            d="M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z"
            fill="black"
          />
        </mask>
      </defs>
      {/* J */}
      <path
        d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z"
        fill="#FD5000"
        mask="url(#nav-j-mask)"
      />
      {/* O petals */}
      <ellipse
        cx="117.717"
        cy="62.9484"
        rx="15.1684"
        ry="18.4624"
        transform="rotate(59.365 117.717 62.9484)"
        fill="#FD5000"
      />
      <ellipse
        cx="126.342"
        cy="20.4592"
        rx="15.1684"
        ry="18.4624"
        transform="rotate(59.365 126.342 20.4592)"
        fill="#FD5000"
      />
      <ellipse
        cx="99.732"
        cy="41.2846"
        rx="14.1752"
        ry="19.4078"
        transform="rotate(28.5804 99.732 41.2846)"
        fill="#FD5000"
      />
      <ellipse
        cx="144.851"
        cy="41.4516"
        rx="14.1752"
        ry="19.4078"
        transform="rotate(28.5804 144.851 41.4516)"
        fill="#FD5000"
      />
      {/* E */}
      <path d="M174 2H232V81H174V65H162V18H174Z" fill="#FD5000" mask="url(#nav-e-mask)" />
      <rect x="231" y="10" width="8" height="29" fill="#FD5000" />
    </svg>
  )
}

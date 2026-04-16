// Logo SVG do HotelFlow — ondas + porta estilizada
export default function Logo({ size = 40, showText = true, light = false }) {
    const textColor = light ? '#FFFFFF' : '#0A3D62';
    const goldColor = '#C49A6C';

    return (
        <div className="flex items-center gap-3 select-none">
            {/* Símbolo */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="HotelFlow logo"
            >
                {/* Porta estilizada */}
                <rect x="13" y="10" width="14" height="22" rx="7" fill={light ? '#ffffff22' : '#0A3D6220'} />
                <rect x="15" y="12" width="10" height="18" rx="5" fill={goldColor} opacity="0.9" />
                {/* Ondas de fluxo */}
                <path
                    d="M6 26 Q10 22 14 26 Q18 30 22 26 Q26 22 30 26 Q34 30 38 26"
                    stroke={light ? 'white' : '#0A3D62'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.7"
                />
                <path
                    d="M6 30 Q10 26 14 30 Q18 34 22 30 Q26 26 30 30 Q34 34 38 30"
                    stroke={goldColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.8"
                />
                {/* Maçaneta */}
                <circle cx="23" cy="21" r="1.5" fill={light ? 'white' : '#0A3D62'} opacity="0.8" />
            </svg>

            {/* Texto */}
            {showText && (
                <div className="flex flex-col leading-none">
                    <span
                        className="font-heading font-bold tracking-tight"
                        style={{ color: textColor, fontSize: size * 0.5 }}
                    >
                        Hotel<span style={{ color: goldColor }}>Flow</span>
                    </span>
                    <span
                        className="font-body font-light tracking-widest uppercase"
                        style={{ color: light ? '#ffffff99' : '#9EA8B3', fontSize: size * 0.22 }}
                    >
                        Organização que flui
                    </span>
                </div>
            )}
        </div>
    );
}

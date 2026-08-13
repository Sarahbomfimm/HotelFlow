import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import Logo from '../../components/Logo/Logo';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const { login, error, clearError } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(true);

    const handleFocusInput = () => {
        setIsReadOnly(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsReadOnly(false);
        clearError();
        setLoading(true);
        await new Promise((r) => setTimeout(r, 400));
        const ok = await login(email.trim(), senha);
        setLoading(false);
        if (ok) navigate('/dashboard');
    };

    return (
        <div className="min-h-screen flex bg-hotel-light">
            {/* Painel esquerdo */}
            <div
                className="hidden lg:flex flex-col justify-between w-[46%] bg-hotel-blue p-12"
                style={{ backgroundImage: 'linear-gradient(135deg, #062135 0%, #0A3D62 50%, #1a5276 100%)' }}
            >
                <Logo size={48} showText light />
                <div className="login-visual-stage mt-16">
                    <div className="login-visual-glow" aria-hidden="true" />
                    <div className="login-visual-card">
                        <svg viewBox="0 0 380 230" className="w-full" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ilustração de prédio com painéis de acompanhamento">
                            <defs>
                                <linearGradient id="hotelBase" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#0f4d7a" />
                                    <stop offset="100%" stopColor="#0b2f4d" />
                                </linearGradient>
                                <linearGradient id="windowGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f4d3ad" stopOpacity="0.95" />
                                    <stop offset="100%" stopColor="#c49a6c" stopOpacity="0.55" />
                                </linearGradient>
                            </defs>

                            <rect x="6" y="14" width="368" height="202" rx="24" fill="#0b2740" opacity="0.65" />
                            <rect x="22" y="32" width="236" height="170" rx="16" fill="url(#hotelBase)" />
                            <rect x="22" y="32" width="236" height="34" rx="16" fill="#114c77" opacity="0.8" />
                            <circle cx="44" cy="49" r="5" fill="#9cd3f6" opacity="0.8" />
                            <circle cx="60" cy="49" r="5" fill="#f3c189" opacity="0.8" />

                            {[0, 1, 2, 3].map((row) => (
                                [0, 1, 2, 3, 4].map((col) => (
                                    <rect
                                        key={`w-${row}-${col}`}
                                        x={40 + (col * 40)}
                                        y={78 + (row * 28)}
                                        width="24"
                                        height="16"
                                        rx="4"
                                        fill="url(#windowGlow)"
                                        opacity={0.75 + ((row + col) % 2) * 0.15}
                                    />
                                ))
                            ))}

                            <rect x="274" y="44" width="84" height="54" rx="10" fill="#123a5d" />
                            <rect x="274" y="106" width="84" height="44" rx="10" fill="#123a5d" />
                            <rect x="274" y="158" width="84" height="32" rx="10" fill="#123a5d" />

                            <polyline points="286,84 304,70 320,78 340,56" fill="none" stroke="#7ed3ff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="286,134 304,128 324,114 342,118" fill="none" stroke="#f3c189" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                            <rect x="286" y="170" width="52" height="10" rx="5" fill="#7ed3ff" opacity="0.65" />
                        </svg>

                        <div className="login-visual-scan" aria-hidden="true" />
                    </div>

                    <div className="mt-7 flex items-center gap-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-hotel-gold/35 bg-hotel-gold/10">
                            <span className="h-2 w-2 rounded-full bg-hotel-gold animate-pulse" />
                        </span>
                        <p className="font-body text-[13px] font-medium tracking-wide text-white/80">
                            Painel operacional em tempo real
                        </p>
                    </div>
                </div>
                <svg viewBox="0 0 400 80" className="w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 40 Q50 10 100 40 Q150 70 200 40 Q250 10 300 40 Q350 70 400 40" stroke="#C49A6C" strokeWidth="3" fill="none" />
                    <path d="M0 55 Q50 25 100 55 Q150 85 200 55 Q250 25 300 55 Q350 85 400 55" stroke="white" strokeWidth="2" fill="none" />
                </svg>
            </div>

            {/* Painel direito */}
            <div className="flex-1 flex flex-col justify-between items-center px-6 py-6 min-h-screen">
                <div className="lg:hidden mt-4">
                    <Logo size={44} />
                </div>

                <div className="w-full max-w-sm my-auto animate-fadeIn py-6">
                    <h1 className="font-heading font-bold text-hotel-blue text-3xl mb-1">Bem-vindo</h1>
                    <p className="text-hotel-gray-md font-body text-sm mb-8">
                        Acesse sua conta para gerenciar as solicitações internas.
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5" autoComplete="off">
                        <div>
                            <label className="label" htmlFor="email">E-mail</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="off"
                                readOnly={isReadOnly}
                                onFocus={handleFocusInput}
                                onClick={handleFocusInput}
                                required
                                className="input"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="label" htmlFor="senha">Senha</label>
                            <div className="relative">
                                <input
                                    id="senha"
                                    name="senha"
                                    type={showPwd ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    readOnly={isReadOnly}
                                    onFocus={handleFocusInput}
                                    onClick={handleFocusInput}
                                    required
                                    className="input pr-11"
                                    placeholder="••••••••"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-hotel-gray-md hover:text-hotel-blue transition-colors"
                                    aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 font-body animate-fadeIn">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !email || !senha}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <LogIn size={18} />
                            }
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>

                <footer className="w-full text-center select-none z-10 pt-4 pb-2">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 max-w-7xl mx-auto text-xs font-body text-hotel-gray-md">
                        <span className="text-slate-500 font-medium">&copy; {new Date().getFullYear()} HotelFlow. Todos os direitos reservados.</span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Desenvolvido por</span>
                            <a
                                href="https://yourpage.com.br/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#9333EA] text-white font-extrabold text-xs tracking-wide shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                            >
                                YourPage
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

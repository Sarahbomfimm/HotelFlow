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

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                <div>
                    <blockquote className="text-white/80 text-xl font-heading leading-relaxed italic mb-6">
                        "Eficiencia em cada andar, excelencia em cada detalhe."
                    </blockquote>
                    <p className="text-hotel-gold font-body text-sm">— Gestao HotelFlow</p>
                </div>
                <svg viewBox="0 0 400 80" className="w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 40 Q50 10 100 40 Q150 70 200 40 Q250 10 300 40 Q350 70 400 40" stroke="#C49A6C" strokeWidth="3" fill="none" />
                    <path d="M0 55 Q50 25 100 55 Q150 85 200 55 Q250 25 300 55 Q350 85 400 55" stroke="white" strokeWidth="2" fill="none" />
                </svg>
            </div>

            {/* Painel direito */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="lg:hidden mb-8">
                    <Logo size={44} />
                </div>

                <div className="w-full max-w-sm animate-fadeIn">
                    <h1 className="font-heading font-bold text-hotel-blue text-3xl mb-1">Bem-vindo</h1>
                    <p className="text-hotel-gray-md font-body text-sm mb-8">
                        Acesse sua conta para gerenciar as ordens de servico.
                    </p>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <div>
                            <label className="label" htmlFor="email">E-mail</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
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
                                    type={showPwd ? 'text' : 'password'}
                                    autoComplete="current-password"
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

                    <details className="mt-8 text-xs text-hotel-gray-md font-body">
                        <summary className="cursor-pointer hover:text-hotel-blue transition-colors select-none">
                            Credenciais de referencia
                        </summary>
                        <div className="mt-3 space-y-1 bg-hotel-light border border-hotel-gray rounded-lg p-3">
                            <p className="text-[11px] text-hotel-gray-md">
                                Com Firebase ativo, use as contas criadas no Authentication com as senhas reais cadastradas no console.
                            </p>
                            <p><strong>Diretora:</strong> sofia@hotelflow.com / sofia123</p>
                            <p><strong>Manutencao:</strong> mauricio@hotelflow.com / mauricio123</p>
                            <p><strong>Controle/Qualidade:</strong> getulio@hotelflow.com / getulio123</p>
                            <p><strong>Hospedagem:</strong> silvio@hotelflow.com / silvio123</p>
                            <p><strong>Financeiro:</strong> cezar@hotelflow.com / cezar123</p>
                        </div>
                    </details>
                </div>
            </div>
        </div>
    );
}

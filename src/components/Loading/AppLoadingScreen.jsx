import { Building2, ClipboardList, BellRing, CheckCircle2 } from 'lucide-react';
import Logo from '../Logo/Logo';

export default function AppLoadingScreen() {
    return (
        <div className="loading-atmosphere min-h-screen w-full overflow-hidden">
            <div className="loading-orb loading-orb-1" />
            <div className="loading-orb loading-orb-2" />
            <div className="loading-orb loading-orb-3" />

            <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
                <div className="loading-panel w-full max-w-xl rounded-2xl p-6 sm:p-8">
                    <div className="mb-6 flex justify-center">
                        <Logo size={52} showText light={false} />
                    </div>

                    <div className="mb-6 text-center">
                        <h2 className="font-heading text-xl font-bold text-hotel-blue sm:text-2xl">
                            Preparando o fluxo da operação
                        </h2>
                        <p className="mt-2 font-body text-sm text-hotel-gray-md">
                            Sincronizando autenticação, equipes e solicitações internas...
                        </p>
                    </div>

                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="loading-chip">
                            <Building2 size={16} />
                            <span>Setores</span>
                        </div>
                        <div className="loading-chip">
                            <ClipboardList size={16} />
                            <span>SIs</span>
                        </div>
                        <div className="loading-chip">
                            <BellRing size={16} />
                            <span>Alertas</span>
                        </div>
                        <div className="loading-chip">
                            <CheckCircle2 size={16} />
                            <span>PDCA</span>
                        </div>
                    </div>

                    <div className="loading-progress-wrap">
                        <div className="loading-progress-bar" />
                    </div>

                    <div className="mt-4 text-center">
                        <span className="font-body text-xs tracking-wide text-hotel-gray-md">
                            HotelFlow | Organizacao que flui
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

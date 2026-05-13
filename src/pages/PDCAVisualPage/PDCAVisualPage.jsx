import { Beaker, Hourglass, Lock } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';

export default function PDCAVisualPage() {
    return (
        <AppLayout pageTitle="PDCA Visual">
            <div className="animate-fadeIn">
                <div className="relative overflow-hidden rounded-[2rem] border border-hotel-gray/40 bg-white p-8 shadow-card sm:p-12">
                    <div className="absolute -top-16 -right-12 h-56 w-56 rounded-full bg-hotel-gold/15 blur-3xl" />
                    <div className="absolute -bottom-16 -left-8 h-56 w-56 rounded-full bg-hotel-blue/10 blur-3xl" />

                    <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-hotel-blue text-white shadow-lg">
                            <Lock size={28} />
                        </div>

                        <h1 className="font-heading text-3xl font-bold text-hotel-blue sm:text-4xl">
                            PDCA Visual em Produção
                        </h1>
                        <p className="mt-4 text-base leading-7 text-hotel-gray-md">
                            Esta funcionalidade está temporariamente bloqueada e será disponibilizada em breve.
                        </p>

                        <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light p-4 text-left">
                                <div className="mb-2 flex items-center gap-2 text-hotel-blue">
                                    <Beaker size={16} />
                                    <span className="text-sm font-semibold">Fase atual</span>
                                </div>
                                <p className="text-sm text-hotel-gray-md">Implementação e validação de layout e métricas.</p>
                            </div>
                            <div className="rounded-2xl border border-hotel-gray/50 bg-hotel-light p-4 text-left">
                                <div className="mb-2 flex items-center gap-2 text-hotel-blue">
                                    <Hourglass size={16} />
                                    <span className="text-sm font-semibold">Previsão</span>
                                </div>
                                <p className="text-sm text-hotel-gray-md">Disponível em breve após homologação interna.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
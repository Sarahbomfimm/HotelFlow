import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../Layout/AppLayout';

export default function AccessDenied({ title = 'Acesso negado', message = 'Você não possui permissão para acessar esta área.' }) {
    const navigate = useNavigate();

    return (
        <AppLayout pageTitle="Acesso negado">
            <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-10">
                <div className="w-full rounded-3xl border border-red-200 bg-white p-8 text-center shadow-[0_16px_40px_rgba(4,21,35,0.08)]">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <ShieldAlert size={30} />
                    </div>
                    <h1 className="mt-5 font-heading text-2xl font-bold text-hotel-blue">{title}</h1>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-hotel-gray-md">
                        {message}
                    </p>
                    <div className="mt-6 flex justify-center">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex items-center gap-2 rounded-xl bg-hotel-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-hotel-blue/90"
                        >
                            <ArrowLeft size={16} /> Voltar ao dashboard
                        </button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
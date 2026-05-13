import { PDCALabel, PDCAStep } from '../../models/OrdemDeServico';

const classes = {
    [PDCAStep.PLAN]: 'bg-red-500 text-white pdca-badge-pulse',
    [PDCAStep.DO]: 'bg-blue-500 text-white pdca-badge-pulse',
    [PDCAStep.CHECK]: 'bg-amber-400 text-white pdca-badge-pulse',
    [PDCAStep.ACT]: 'bg-emerald-500 text-white pdca-badge-pulse',
};

export default function PDCABadge({ etapa, status, compact = false }) {
    if (!etapa) return null;

    return (
        <span
            title={`Etapa PDCA: ${PDCALabel[etapa] || etapa}`}
            className={`inline-flex items-center justify-center rounded-full font-bold shadow-sm ${classes[etapa] || classes[PDCAStep.PLAN]} ${compact ? 'h-6 min-w-6 px-2 text-xs' : 'h-7 min-w-7 px-2.5 text-xs'}`}
        >
            {etapa}
        </span>
    );
}
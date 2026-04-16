import { StatusLabel } from '../../models/OrdemDeServico';

const classes = {
    aberto: 'status-aberto',
    em_andamento: 'status-em_andamento',
    concluido: 'status-concluido',
};

const dots = {
    aberto: 'bg-blue-500',
    em_andamento: 'bg-amber-500',
    concluido: 'bg-emerald-500',
};

export default function StatusBadge({ status }) {
    return (
        <span className={classes[status] || 'status-aberto'}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${dots[status] || 'bg-blue-500'}`} />
            {StatusLabel[status] || status}
        </span>
    );
}
